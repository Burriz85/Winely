import { createVmpClient, defaultWindow, isWineType, type Wine } from '@vinskap/shared';
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase';

/**
 * Produktdata fra vinmonopolet.no for å fylle ut arket for en ny vin (type, årgang, pris …).
 * Gir null etter 5 s eller ved feil; da fyller brukeren ut selv som før.
 */
export async function previewDetails(nr: string): Promise<Partial<Wine> | null> {
  const call = supabase.functions.invoke('vmp-sync', { body: { vmp_nr: nr, preview: true } })
    .then(({ data }) => (data?.details ?? null) as Record<string, any> | null)
    .catch(() => null);
  const d = await Promise.race([call, new Promise<null>((r) => setTimeout(() => r(null), 5000))]);
  if (!d) return null;
  const p: Partial<Wine> = {};
  if (isWineType(d.type)) p.type = d.type;
  if (d.vintage) Object.assign(p, { year: d.vintage }, defaultWindow(d.vintage));
  if (d.price) p.price = Number(d.price);
  if (d.producer) p.producer = d.producer;
  if (d.country) p.country = d.country;
  if (d.region) p.region = d.region;
  if (d.grapes?.length) p.grape = d.grapes.join(', ');
  if (d.abv != null) p.abv = String(d.abv).replace('.', ',') + ' %';
  if (d.taste) p.taste = d.taste;
  if (d.food) p.food = d.food;
  return p;
}

export const vmp = createVmpClient({
  baseUrl: SUPABASE_URL + '/functions/v1/vmp',
  headers: async () => {
    const { data } = await supabase.auth.getSession();
    return { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + (data.session?.access_token ?? SUPABASE_ANON_KEY) };
  },
});

/** Open Food Facts: gir ofte produktnavnet for en EAN, som kan fylle ut søkefeltet på forhånd. */
export async function offName(ean: string): Promise<string> {
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${ean}.json?fields=product_name,brands`);
    if (!r.ok) return '';
    const j = await r.json();
    return (j?.product?.product_name || '').trim();
  } catch {
    return '';
  }
}
