import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export type Status = 'aktiv' | 'invitert' | 'deaktivert';
export type AdminUser = {
  id: string; name: string; email: string; status: Status; is_admin: boolean; created_at: string;
  last_active: string | null; cellar_ids: string[]; bottles: number; scans: number;
};
export type AdminCellar = {
  id: string; name: string; owner_id: string; created_at: string; members: number; bottles: number; wines: number; value: number; updated_at: string | null;
};
export type Member = { cellar_id: string; user_id: string; role: 'owner' | 'member' };
export type EanRow = {
  ean: string; product_id: string; vmp_nr: string | null; name: string; created_by: string | null; created_at: string;
  mapped: boolean; hits: number; conflict: boolean;
};
export type Dupe = {
  keep_id: string; keep_name: string; keep_nr: string | null; merge_id: string; merge_name: string;
  keep_cellars: number; keep_bottles: number; merge_cellars: number; merge_bottles: number; reason: string;
};
export type Activity = { created_at: string; actor: string | null; kind: 'inn' | 'ut' | 'ean' | 'admin' | 'auth'; what: string };

const must = <T,>(r: { data: T | null; error: { message: string } | null }) => {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
};

export const useUsers = () => useQuery({
  queryKey: ['users'],
  queryFn: async () => must<AdminUser[]>(await supabase.rpc('admin_users')),
});

export const useCellars = () => useQuery({
  queryKey: ['cellars'],
  queryFn: async () => must<AdminCellar[]>(await supabase.from('admin_cellars').select('*').order('bottles', { ascending: false })),
});

export const useMembers = () => useQuery({
  queryKey: ['members'],
  queryFn: async () => must<Member[]>(await supabase.from('cellar_members').select('cellar_id,user_id,role')),
});

export const useCellarItems = (id: string | null) => useQuery({
  queryKey: ['cellar-items', id],
  enabled: !!id,
  queryFn: async () => {
    const rows = must<any[]>(await supabase.from('cellar_items').select('qty,product:products(vmp_nr,name,image_url)').eq('cellar_id', id!).gt('qty', 0));
    return rows.map((r) => ({ qty: r.qty as number, nr: (r.product?.vmp_nr ?? '') as string, name: (r.product?.name ?? '') as string, img: (r.product?.image_url ?? '') as string }));
  },
});

export const useEans = () => useQuery({
  queryKey: ['eans'],
  queryFn: async () => must<EanRow[]>(await supabase.from('admin_eans').select('*').order('created_at', { ascending: false })),
});

export const useDupes = () => useQuery({
  queryKey: ['dupes'],
  queryFn: async () => must<Dupe[]>(await supabase.from('admin_duplicates').select('*')),
});

export const useActivity = (limit = 300) => useQuery({
  queryKey: ['activity', limit],
  queryFn: async () => must<Activity[]>(await supabase.from('admin_activity').select('*').order('created_at', { ascending: false }).limit(limit)),
});

export const useScansPerDay = () => useQuery({
  queryKey: ['scans-per-day'],
  queryFn: async () => must<{ day: string; n: number }[]>(await supabase.rpc('admin_scans_per_day', { p_days: 14 })),
});

export type ApiHealth = {
  latest: { status: number; latency_ms: number; at: string } | null;
  calls24h: number; errors24h: number;
  lastError: { status: number; error: string | null; at: string } | null;
  lastSync: string | null;
};

export const useApiHealth = () => useQuery({
  queryKey: ['api-health'],
  queryFn: async (): Promise<ApiHealth> => {
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const t = () => supabase.from('api_health');
    const [latest, calls, errors, lastError, lastSync] = await Promise.all([
      t().select('status,latency_ms,at').order('at', { ascending: false }).limit(1),
      t().select('id', { count: 'exact', head: true }).gte('at', since),
      t().select('id', { count: 'exact', head: true }).gte('at', since).or('status.gte.400,error.not.is.null'),
      t().select('status,error,at').or('status.gte.400,error.not.is.null').order('at', { ascending: false }).limit(1),
      t().select('at').eq('source', 'sync').order('at', { ascending: false }).limit(1),
    ]);
    for (const r of [latest, calls, errors, lastError, lastSync]) if (r.error) throw new Error(r.error.message);
    return {
      latest: (latest.data?.[0] as ApiHealth['latest']) ?? null,
      calls24h: calls.count ?? 0,
      errors24h: errors.count ?? 0,
      lastError: (lastError.data?.[0] as ApiHealth['lastError']) ?? null,
      lastSync: (lastSync.data?.[0] as { at: string } | undefined)?.at ?? null,
    };
  },
});

/** Navn for en bruker-id (aktivitet, strekkoder, skap). */
export function useNameOf() {
  const { data } = useUsers();
  return (id: string | null | undefined) => (id && data?.find((u) => u.id === id)?.name) || '—';
}
