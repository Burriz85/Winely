// Vinrådgiver: foreslår viner fra brukerens eget skap til en rett eller anledning.
//  POST { cellar_id, question }  – innlogget, aktiv bruker som er medlem av skapet
//  → { ok: true, summary, picks: [{ product_id, vmp_nr, reason }] }
// Skapet leses her med brukerens eget token (RLS), ikke fra klienten, så modellen bare ser viner
// brukeren har tilgang til, og svaret sjekkes mot listen før det sendes tilbake.
// Deploy: supabase secrets set ANTHROPIC_API_KEY=... && supabase functions deploy advisor
import Anthropic from 'npm:@anthropic-ai/sdk@0.129';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildEntries, type CellarRow, MAX_QUESTION, SCHEMA, systemPrompt, validatePicks } from '../_shared/advisor.ts';
import { CORS, json } from '../_shared/cors.ts';
import { PUBLIC_KEY, SECRET_KEY } from '../_shared/keys.ts';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(URL_, SECRET_KEY);
const COLS = 'qty,drink_from,drink_to,product:products(id,vmp_nr,name,producer,vintage,type,country,region,grapes,abv,price,taste,food)';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const caller = createClient(URL_, PUBLIC_KEY, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: active } = await caller.rpc('is_active');
  if (!active) return new Response('Forbidden', { status: 403, headers: CORS });

  const body = await req.json().catch(() => ({}));
  const cellar = typeof body.cellar_id === 'string' ? body.cellar_id : '';
  const question = typeof body.question === 'string' ? body.question.trim().slice(0, MAX_QUESTION) : '';
  if (!cellar || !question) return json({ ok: false, error: 'Skriv hva vinen skal brukes til.' }, 400);

  // RLS: bare skap brukeren er medlem av gir rader.
  const { data: rows, error } = await caller.from('cellar_items').select(COLS).eq('cellar_id', cellar).gt('qty', 0);
  if (error) return json({ ok: false, error: 'Fikk ikke lest skapet.' }, 502);
  const year = new Date().getFullYear();
  const entries = buildEntries((rows ?? []) as unknown as CellarRow[], year);
  if (!entries.length) return json({ ok: true, summary: 'Skapet er tomt, så jeg har ingenting å foreslå ennå.', picks: [] });

  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) return json({ ok: false, error: 'Vinrådgiveren er ikke satt opp (ANTHROPIC_API_KEY mangler).' }, 503);

  const client = new Anthropic({ apiKey: key });
  const t0 = performance.now();
  const log = (status: number, err: string | null) =>
    admin.from('api_health').insert({ status, latency_ms: Math.round(performance.now() - t0), error: err, source: 'advisor' });
  try {
    const res = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 8000,
      // Kort vurdering mot en liste: lav innsats gir raskt svar, som betyr mye når man står ved skapet.
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      // Avslår sikkerhetsfiltrene forespørselen, prøves den automatisk på en annen modell.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: systemPrompt(entries, year),
      messages: [{ role: 'user', content: question }],
    });

    if (res.stop_reason === 'refusal') {
      await log(422, 'refusal');
      return json({ ok: false, error: 'Fikk ikke svar på det spørsmålet. Prøv å formulere det annerledes.' }, 422);
    }
    const text = res.content.find((b) => b.type === 'text');
    let out: { summary?: unknown; picks?: unknown } | null = null;
    try {
      out = text && text.type === 'text' ? JSON.parse(text.text) : null;
    } catch {
      out = null;
    }
    if (!out) {
      await log(502, 'ugyldig svar (' + res.stop_reason + ')');
      return json({ ok: false, error: 'Fikk ikke et brukbart svar. Prøv igjen.' }, 502);
    }
    await log(200, null);
    const picks = validatePicks(out.picks, entries);
    const summary = typeof out.summary === 'string' ? out.summary.trim().slice(0, 600) : '';
    return json({ ok: true, summary, picks });
  } catch (e) {
    const status = e instanceof Anthropic.APIError ? e.status ?? 502 : 502;
    await log(status, (e as Error).message.slice(0, 200));
    return json({ ok: false, error: status === 429 ? 'For mange spørsmål akkurat nå. Prøv igjen om litt.' : 'Vinrådgiveren svarte ikke. Prøv igjen.' }, 502);
  }
});
