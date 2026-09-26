import { createVmpClient } from '@vinskap/shared';
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase';

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
