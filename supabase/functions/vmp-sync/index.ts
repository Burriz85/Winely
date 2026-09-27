// Oppdaterer produktnavn fra Vinmonopolet.
//  • Cron (Authorization: Bearer <SERVICE_ROLE_KEY>), uten body: alle produkter endret siden i går.
//  • Innlogget bruker, body { vmp_nr }: ett produkt («Oppdater fra API» i appen).
// Deploy: supabase functions deploy vmp-sync
import { createClient } from 'npm:@supabase/supabase-js@2';
import { CORS, json, jwtRole } from '../_shared/cors.ts';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(URL_, SERVICE);
const PAGE = 500;

type VmpRow = { basic?: { productId?: string | number; productShortName?: string } };

async function vmp(params: Record<string, string>, source: 'sync' | 'proxy') {
  const q = new URLSearchParams(params);
  const t0 = performance.now();
  let r: Response;
  try {
    r = await fetch((Deno.env.get('VMP_BASE_URL') ?? 'https://apis.vinmonopolet.no') + '/products/v0/details-normal?' + q, {
      headers: { 'Ocp-Apim-Subscription-Key': Deno.env.get('VMP_KEY') ?? '' },
    });
  } catch (e) {
    await admin.from('api_health').insert({ status: 502, latency_ms: Math.round(performance.now() - t0), error: (e as Error).message, source });
    throw e;
  }
  await admin.from('api_health').insert({
    status: r.status, latency_ms: Math.round(performance.now() - t0), error: r.ok ? null : `${r.status} ${r.statusText}`.trim(), source,
  });
  if (!r.ok) throw new Error('Vinmonopolet svarte ' + r.status);
  const data = await r.json();
  return (Array.isArray(data) ? data : []) as VmpRow[];
}

async function apply(rows: VmpRow[]) {
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
      const rows = await vmp({ productId: nr }, 'proxy');
      if (!rows.length) return json({ ok: false, found: false }, 404);
      await apply(rows);
      return json({ ok: true, found: true, name: rows[0].basic?.productShortName ?? null });
    }

    // Gatewayen har verifisert signaturen. Sjekk rollen i stedet for å sammenligne med
    // SUPABASE_SERVICE_ROLE_KEY, som på hostet Supabase kan være en annen nøkkeltype.
    if (jwtRole(auth) !== 'service_role') return new Response('Forbidden: krever service_role', { status: 403, headers: CORS });
    const since = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    let start = 0, updated = 0, seen = 0;
    for (;;) {
      const rows = await vmp({ changedSince: since, maxResults: String(PAGE), start: String(start) }, 'sync');
      seen += rows.length;
      updated += await apply(rows);
      if (rows.length < PAGE) break;
      start += PAGE;
    }
    return json({ ok: true, since, seen, updated });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 502);
  }
});
