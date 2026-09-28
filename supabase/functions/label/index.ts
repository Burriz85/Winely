// Leser en vinetikett fra et bilde med Claude og returnerer strukturerte felt.
//  POST { image: <base64 JPEG>, media_type?: 'image/jpeg' | 'image/png' | 'image/webp' }  – innlogget, aktiv bruker
//  → { ok: true, label: { name, producer, vintage, type, country, region, grapes, search_query } }
// Brukes når vinen ikke finnes hos Vinmonopolet: appen søker først med search_query, og fyller
// ellers ut skjemaet for manuell vin. Bildet lagres ikke.
// Deploy: supabase secrets set ANTHROPIC_API_KEY=... && supabase functions deploy label
import Anthropic from 'npm:@anthropic-ai/sdk@0.129';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { CORS, json } from '../_shared/cors.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const MAX_BYTES = 4_000_000; // appen skalerer ned til ~1280 px, som gir godt under dette

const SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Vinens navn slik det står på etiketten, inkludert cuvée. Tom streng hvis uleselig.' },
    producer: { type: 'string', description: 'Produsent / château / domaine. Tom streng hvis ukjent.' },
    vintage: { type: 'integer', description: 'Årgang (fire siffer). 0 hvis ingen årgang (NV) eller uleselig.' },
    type: { type: 'string', enum: ['Rødvin', 'Hvitvin', 'Musserende', 'Rosévin', 'Ukjent'] },
    country: { type: 'string', description: 'Land på norsk, f.eks. Frankrike, Italia, Spania. Tom streng hvis ukjent.' },
    region: { type: 'string', description: 'Distrikt/appellasjon, f.eks. Barolo, Chablis, Rioja. Tom streng hvis ukjent.' },
    grapes: { type: 'array', items: { type: 'string' }, description: 'Druer som står på etiketten eller følger entydig av appellasjonen. Tom liste hvis usikkert.' },
    search_query: { type: 'string', description: 'Kort søkeord for Vinmonopolets produktsøk: produsent og navn, uten årgang, maks 4 ord.' },
  },
  required: ['name', 'producer', 'vintage', 'type', 'country', 'region', 'grapes', 'search_query'],
  additionalProperties: false,
} as const;

const PROMPT = `Dette er et bilde av etiketten på en vinflaske. Les av det som faktisk står på etiketten.
Gjett ikke på detaljer som ikke står der og ikke følger entydig av appellasjonen; bruk tom verdi i stedet.
Bestem type (rødvin, hvitvin, musserende, rosévin) ut fra etiketten, appellasjonen og druene; bruk «Ukjent» hvis det ikke går.
Er bildet ikke en vinetikett, returner tomme verdier.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const caller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: active } = await caller.rpc('is_active');
  if (!active) return new Response('Forbidden', { status: 403, headers: CORS });

  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) return json({ ok: false, error: 'Etikettlesing er ikke satt opp (ANTHROPIC_API_KEY mangler).' }, 503);

  const body = await req.json().catch(() => ({}));
  const image = typeof body.image === 'string' ? body.image.replace(/^data:[^,]+,/, '') : '';
  const media = ['image/jpeg', 'image/png', 'image/webp'].includes(body.media_type) ? body.media_type : 'image/jpeg';
  if (!image || image.length * 0.75 > MAX_BYTES) return json({ ok: false, error: 'Mangler bilde, eller bildet er for stort.' }, 400);

  const client = new Anthropic({ apiKey: key });
  const t0 = performance.now();
  try {
    const res = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 4000,
      // Enkel avlesning: lav innsats holder, og gir raskere og billigere svar.
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      // Avslår sikkerhetsfiltrene forespørselen, prøves den automatisk på en annen modell.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: media, data: image } },
          { type: 'text', text: PROMPT },
        ],
      }],
    });

    const ms = Math.round(performance.now() - t0);
    if (res.stop_reason === 'refusal') {
      await admin.from('api_health').insert({ status: 422, latency_ms: ms, error: 'refusal', source: 'label' });
      return json({ ok: false, error: 'Kunne ikke lese etiketten.' }, 422);
    }
    const text = res.content.find((b) => b.type === 'text');
    const label = text && text.type === 'text' ? JSON.parse(text.text) : null;
    await admin.from('api_health').insert({ status: 200, latency_ms: ms, error: null, source: 'label' });
    if (!label) return json({ ok: false, error: 'Kunne ikke lese etiketten.' }, 422);
    return json({ ok: true, label });
  } catch (e) {
    const status = e instanceof Anthropic.APIError ? e.status ?? 502 : 502;
    await admin.from('api_health').insert({
      status, latency_ms: Math.round(performance.now() - t0), error: (e as Error).message.slice(0, 200), source: 'label',
    });
    return json({ ok: false, error: status === 429 ? 'For mange forespørsler akkurat nå. Prøv igjen om litt.' : 'Etikettlesingen feilet.' }, 502);
  }
});
