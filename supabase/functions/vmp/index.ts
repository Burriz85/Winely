// Supabase Edge Function: /functions/v1/vmp/*  → apis.vinmonopolet.no/*
// Deploy: supabase secrets set VMP_KEY=... && supabase functions deploy vmp
// VMP_BASE_URL overstyrer upstream, bare for lokal testing (tests/mock-vmp.mjs).
// Krever innlogget bruker (JWT), ellers kan hvem som helst bruke opp kvoten via proxyen.
// Hvert kall logges i api_health.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { CORS, jwtRole } from '../_shared/cors.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  // Gatewayen har verifisert signaturen (verify_jwt), men anon-nøkkelen er også en gyldig JWT.
  // Krev en innlogget bruker.
  if (jwtRole(req.headers.get('Authorization')) !== 'authenticated') {
    return new Response('Logg inn først', { status: 401, headers: CORS });
  }
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/vmp/, '');
  if (!/^\/products\/v0\/details-normal$/.test(path)) return new Response('Not allowed', { status: 403, headers: CORS });
  const source = url.searchParams.get('_source') === 'test' ? 'test' : 'proxy';
  url.searchParams.delete('_source');

  const t0 = performance.now();
  let status = 0, body = '', error: string | null = null;
  try {
    const r = await fetch((Deno.env.get('VMP_BASE_URL') ?? 'https://apis.vinmonopolet.no') + path + url.search, {
      headers: { 'Ocp-Apim-Subscription-Key': Deno.env.get('VMP_KEY') ?? '' },
    });
    status = r.status;
    body = await r.text();
    if (!r.ok) error = `${r.status} ${r.statusText}`.trim();
  } catch (e) {
    status = 502;
    error = 'Kunne ikke nå Vinmonopolet: ' + (e as Error).message;
    body = JSON.stringify({ error });
  }
  const latency = Math.round(performance.now() - t0);
  await admin.from('api_health').insert({ status, latency_ms: latency, error, source });

  return new Response(body, {
    status,
    headers: {
      ...CORS,
      'Content-Type': 'application/json',
      'Cache-Control': status === 200 ? 'private, max-age=3600' : 'no-store',
      'X-Upstream-Latency': String(latency),
    },
  });
});
