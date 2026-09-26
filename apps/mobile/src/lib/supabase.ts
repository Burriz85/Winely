import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// SecureStore tåler bare ~2 KB per verdi, og en Supabase-økt er ofte større.
// Derfor deles verdien i biter: key.n = antall biter, key.0 … key.(n-1).
const CHUNK = 1800;
const chunkedSecureStore = {
  async getItem(key: string) {
    const n = Number(await SecureStore.getItemAsync(key + '.n'));
    if (!n) return null;
    const parts = await Promise.all(Array.from({ length: n }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`)));
    return parts.some((p) => p == null) ? null : parts.join('');
  },
  async setItem(key: string, value: string) {
    const old = Number(await SecureStore.getItemAsync(key + '.n')) || 0;
    const parts = value.match(new RegExp(`[\\s\\S]{1,${CHUNK}}`, 'g')) ?? [''];
    await Promise.all(parts.map((p, i) => SecureStore.setItemAsync(`${key}.${i}`, p)));
    await SecureStore.setItemAsync(key + '.n', String(parts.length));
    for (let i = parts.length; i < old; i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
  },
  async removeItem(key: string) {
    const n = Number(await SecureStore.getItemAsync(key + '.n')) || 0;
    for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
    await SecureStore.deleteItemAsync(key + '.n');
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // På web bruker supabase-js localStorage som standard.
    storage: Platform.OS === 'web' ? undefined : chunkedSecureStore,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/** Norske feilmeldinger for det brukeren kan møte. */
export function authError(msg: string | undefined) {
  const m = (msg || '').toLowerCase();
  if (m.includes('invalid login')) return 'Feil e-post eller passord.';
  if (m.includes('banned')) return 'Kontoen er deaktivert. Kontakt administrator.';
  if (m.includes('expired') || m.includes('invalid') && m.includes('otp') || m.includes('token')) return 'Koden er feil eller utløpt.';
  if (m.includes('password')) return 'Passordet må ha minst 8 tegn.';
  if (m.includes('network') || m.includes('fetch')) return 'Fikk ikke kontakt med serveren. Sjekk nettet.';
  return msg || 'Noe gikk galt.';
}
