// Oppdaterer produkter fra Vinmonopolet.
//  • Cron (service_role), uten body: navn for alle produkter endret siden i går, og full produktdata
//    for inntil 40 produkter som mangler den eller er eldre enn 30 dager.
//  • Innlogget bruker, body { vmp_nr }: ett produkt («Oppdater fra API», og etter at en ny vin er satt inn).
//  • Innlogget bruker, body { vmp_nr, preview: true }: returner produktdata uten å lagre (fyller ut arket for ny vin).
//
// Navn kommer fra det offisielle API-et (products/v0). Type, årgang, pris, land, distrikt, druer,
// alkohol, smak og mat kommer fra vinmonopolet.no sitt eget nettsted (vmpws/v3), som IKKE er et
// offisielt API. Feiler det, fortsetter alt annet som før.
// Deploy: supabase functions deploy vmp-sync
import { createClient } from 'npm:@supabase/supabase-js@2';
import { XMLParser } from 'npm:fast-xml-parser@5';
import { CORS, json, jwtRole } from '../_shared/cors.ts';
import { normalizeDetails, type VmpDetails } from '../_shared/vmpweb.ts';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(URL_, SERVICE);
const PAGE = 500;
const WEB = Deno.env.get('VMP_WEB_BASE_URL') ?? 'https://www.vinmonopolet.no';

type VmpRow = { basic?: { productId?: string | number; productShortName?: string } };
type Source = 'sync' | 'proxy' | 'web';

const logHealth = (source: Source, status: number, t0: number, error: string | null) =>
  admin.from('api_health').insert({ status, latency_ms: Math.round(performance.now() - t0), error, source });

async function vmp(params: Record<string, string>, source: 'sync' | 'proxy') {
  const q = new URLSearchParams(params);
  const t0 = performance.now();
  let r: Response;
  try {
    r = await fetch((Deno.env.get('VMP_BASE_URL') ?? 'https://apis.vinmonopolet.no') + '/products/v0/details-normal?' + q, {
      headers: { 'Ocp-Apim-Subscription-Key': Deno.env.get('VMP_KEY') ?? '' },
    });
  } catch (e) {
    await logHealth(source, 502, t0, (e as Error).message);
    throw e;
  }
  await logHealth(source, r.status, t0, r.ok ? null : `${r.status} ${r.statusText}`.trim());
  if (!r.ok) throw new Error('Vinmonopolet svarte ' + r.status);
  const data = await r.json();
  return (Array.isArray(data) ? data : []) as VmpRow[];
}

/** Full produktdata fra vinmonopolet.no. null hvis det ikke går (blokkert, endret format, ukjent varenr.). */
async function details(nr: string): Promise<VmpDetails | null> {
  const t0 = performance.now();
  try {
    const r = await fetch(`${WEB}/vmpws/v3/vmp/products/${nr}?fields=FULL`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (Vinskap; privat vinskap-app)' },
      signal: AbortSignal.timeout(8000),
    });
    const text = await r.text();
    await logHealth('web', r.status, t0, r.ok ? null : `${r.status} ${text.slice(0, 120)}`);
    if (!r.ok) return null;
    const obj = text.trimStart().startsWith('<')
      ? new XMLParser({ parseTagValue: false, ignoreAttributes: true }).parse(text)
      : JSON.parse(text);
    return normalizeDetails(obj);
  } catch (e) {
    await logHealth('web', 502, t0, (e as Error).message);
    return null;
  }
}

/** Skriv produktdata. Felt vinmonopolet.no ikke har, røres ikke. */
async function saveDetails(d: VmpDetails) {
  const row: Record<string, unknown> = { details_updated_at: new Date().toISOString() };
  for (const k of ['name', 'producer', 'vintage', 'type', 'country', 'region', 'grapes', 'abv', 'price', 'volume_cl', 'taste', 'food'] as const) {
    if (d[k] != null) row[k] = d[k];
  }
  await admin.from('products').update(row).eq('vmp_nr', d.vmp_nr);
}

async function applyNames(rows: VmpRow[]) {
  let n = 0;
  for (const row of rows) {
    const nr = row.basic?.productId != null ? String(row.basic.productId) : '';
    const name = row.basic?.productShortName?.trim();
    if (!nr || !name) continue;
    const { data } = await admin.from('products')
      .update({ name, vmp_updated_at: new Date().toISOString() })
      .eq('vmp_nr', nr).select('id');
    n += data?.length ?? 0;
  }
  return n;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const auth = req.headers.get('Authorization') ?? '';
  const body = await req.json().catch(() => ({}));

  try {
    if (body?.vmp_nr) {
      const caller = createClient(URL_, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
      const { data: active } = await caller.rpc('is_active');
      if (!active) return new Response('Forbidden', { status: 403, headers: CORS });
      const nr = String(body.vmp_nr);
      if (!/^\d{1,12}$/.test(nr)) return new Response('Ugyldig varenummer', { status: 400, headers: CORS });

      const d = await details(nr);
      if (body.preview) return json({ ok: true, details: d });

      // Navnet fra det offisielle API-et; mangler det, brukes navnet fra nettstedet.
      const rows = await vmp({ productId: nr }, 'proxy').catch(() => [] as VmpRow[]);
      if (rows.length) await applyNames(rows);
      if (d) await saveDetails(d);
      if (!rows.length && !d) return json({ ok: false, found: false }, 404);
      return json({ ok: true, found: true, name: rows[0]?.basic?.productShortName ?? d?.name ?? null, details: !!d });
    }

    // Gatewayen har verifisert signaturen. Sjekk rollen i stedet for å sammenligne med
    // SUPABASE_SERVICE_ROLE_KEY, som på hostet Supabase kan være en annen nøkkeltype.
    if (jwtRole(auth) !== 'service_role') return new Response('Forbidden: krever service_role', { status: 403, headers: CORS });
    const since = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    let start = 0, updated = 0, seen = 0;
    for (;;) {
      const rows = await vmp({ changedSince: since, maxResults: String(PAGE), start: String(start) }, 'sync');
      seen += rows.length;
      updated += await applyNames(rows);
      if (rows.length < PAGE) break;
      start += PAGE;
    }

    // Full produktdata, litt hver natt så nettstedet ikke belastes.
    const stale = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { data: todo } = await admin.from('products').select('vmp_nr')
      .not('vmp_nr', 'is', null)
      .or(`details_updated_at.is.null,details_updated_at.lt.${stale}`)
      .limit(40);
    let detailed = 0;
    for (const p of todo ?? []) {
      const d = await details(p.vmp_nr);
      if (d) { await saveDetails(d); detailed++; }
      await new Promise((r) => setTimeout(r, 500));
    }
    return json({ ok: true, since, seen, updated, detailed });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 502);
  }
});
