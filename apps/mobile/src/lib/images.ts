// Bilder av viner som ikke finnes hos Vinmonopolet, lagret i Supabase Storage (bøtta wine-images).
import { supabase } from './supabase';

/** Laster opp et JPEG-bilde (base64) og gir den offentlige adressen. */
export async function uploadWineImage(productId: string, base64: string): Promise<string> {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const path = `manual/${productId}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('wine-images').upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error('Kunne ikke laste opp bildet: ' + error.message);
  return supabase.storage.from('wine-images').getPublicUrl(path).data.publicUrl;
}

/** Knytter bildet til vinen (bare viner uten varenummer, i et skap du er med i). */
export async function setWineImage(cellarId: string, productId: string, url: string) {
  const { error } = await supabase.rpc('set_wine_image', { p_cellar: cellarId, p_product: productId, p_url: url });
  if (error) throw new Error('Kunne ikke lagre bildet: ' + error.message);
}
