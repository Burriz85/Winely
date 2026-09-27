// supabase-js sender også apikey og x-client-info, så de må være med i preflight-svaret.
export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

/** Rollen i en JWT som gatewayen allerede har verifisert (verify_jwt). null hvis ikke en JWT. */
export function jwtRole(auth: string | null): string | null {
  try {
    const payload = (auth ?? '').replace(/^Bearer\s+/i, '').split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).role ?? null;
  } catch {
    return null;
  }
}
