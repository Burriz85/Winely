// Nøkler for Supabase-klientene i funksjonene.
// SB_SECRET_KEY (sb_secret_…) og SB_PUBLISHABLE_KEY (sb_publishable_…) settes med
//   supabase secrets set SB_SECRET_KEY=… SB_PUBLISHABLE_KEY=…
// og brukes når de finnes. Ellers brukes de gamle JWT-nøklene (service_role/anon) som Supabase
// legger inn selv. De slutter å virke når den gamle JWT-hemmeligheten trekkes tilbake.
export const SECRET_KEY = Deno.env.get('SB_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
export const PUBLIC_KEY = Deno.env.get('SB_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!;

/** Lik i konstant tid, så svartiden ikke røper hvor mange tegn som stemmer. */
function same(a: string, b: string) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/**
 * Kallet er fra cron eller en annen tjeneste: Authorization er «Bearer <hemmelig nøkkel>».
 * Sammenligner med selve nøkkelen i stedet for å lese rollen i en JWT, fordi funksjoner som
 * bruker dette kjøres uten verify_jwt (sb_secret_-nøkler er ikke JWT-er).
 */
export function isServiceCall(req: Request): boolean {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return false;
  return [Deno.env.get('SB_SECRET_KEY'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')]
    .some((k) => !!k && same(token, k));
}
