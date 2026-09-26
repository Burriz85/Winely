import { createClient } from '@supabase/supabase-js';
import { createVmpClient } from '@vinskap/shared';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
export const VMP_QUOTA = import.meta.env.VITE_VMP_QUOTA || '—';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const vmp = createVmpClient({
  baseUrl: SUPABASE_URL + '/functions/v1/vmp',
  headers: async () => {
    const { data } = await supabase.auth.getSession();
    return { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + (data.session?.access_token ?? '') };
  },
});

/** Kaller admin-invite og gir en norsk feilmelding tilbake (null = ok). */
export async function adminAction(body: Record<string, unknown>): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('admin-invite', { body });
  if (!error) return data?.ok === false ? data.error : null;
  const ctx = (error as { context?: Response }).context;
  const j = await ctx?.json?.().catch(() => null);
  return j?.error || error.message;
}

export async function logAdmin(action: string, target?: string) {
  const { data } = await supabase.auth.getUser();
  await supabase.from('audit_log').insert({ actor: data.user?.id, kind: 'admin', action, target: target ?? null });
}
