import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { defaultWindow, isWineType, vmpImage, type Wine } from '@vinskap/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './auth';
import { flush, queue, type Op } from './queue';
import { supabase } from './supabase';
import { vmp } from './vmp';

type ProductRow = {
  id: string; vmp_nr: string | null; name: string; producer: string | null; vintage: number | null; type: string | null;
  country: string | null; region: string | null; grapes: string[] | null; abv: number | null; price: number | null; image_url: string | null;
};

export function productToWine(p: ProductRow, item?: { qty: number; drink_from: number | null; drink_to: number | null }): Wine {
  const year = p.vintage ?? null;
  const w = defaultWindow(year);
  return {
    productId: p.id, nr: p.vmp_nr ?? '', name: p.name, producer: p.producer ?? '', year,
    type: isWineType(p.type) ? p.type : null, country: p.country ?? '', region: p.region ?? '',
    grape: (p.grapes ?? []).join(', '), abv: p.abv != null ? String(p.abv).replace('.', ',') + ' %' : '',
    price: Number(p.price ?? 0), taste: '', food: '', qty: item?.qty ?? 0,
    from: item?.drink_from ?? w.from, to: item?.drink_to ?? w.to, img: p.image_url || vmpImage(p.vmp_nr),
  };
}

// ─── Skap ────────────────────────────────────────────────────

export type Cellar = { id: string; name: string; owner_id: string; role: 'owner' | 'member'; bottles: number };

const CELLAR_KEY = 'vinskap.cellar';
type CellarCtx = { cellars: Cellar[]; cellar: Cellar | null; setCellar: (id: string) => void; loading: boolean };
const CellarContext = createContext<CellarCtx | null>(null);

export function CellarProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const uid = session?.user.id;
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => { AsyncStorage.getItem(CELLAR_KEY).then(setPicked).catch(() => {}); }, []);

  const q = useQuery({
    queryKey: ['cellars', uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from('cellars')
        .select('id,name,owner_id,cellar_members(user_id,role),cellar_items(qty)');
      if (error) throw error;
      return (data ?? []).map((c: any): Cellar => ({
        id: c.id, name: c.name, owner_id: c.owner_id,
        role: c.cellar_members.find((m: any) => m.user_id === uid)?.role ?? 'member',
        bottles: c.cellar_items.reduce((a: number, i: any) => a + i.qty, 0),
      }));
    },
  });

  const cellars = q.data ?? [];
  // Standard: eget skap. Er det tomt og du er med i et delt skap med flasker, vises det delte.
  const own = cellars.find((c) => c.role === 'owner');
  const shared = cellars.find((c) => c.role === 'member' && c.bottles > 0);
  const cellar = cellars.find((c) => c.id === picked) ?? (own && (own.bottles > 0 || !shared) ? own : shared ?? cellars[0] ?? null);

  const setCellar = useCallback((id: string) => {
    setPicked(id);
    AsyncStorage.setItem(CELLAR_KEY, id).catch(() => {});
  }, []);

  return <CellarContext.Provider value={{ cellars, cellar, setCellar, loading: q.isLoading }}>{children}</CellarContext.Provider>;
}

export function useCellar() {
  const v = useContext(CellarContext);
  if (!v) throw new Error('useCellar utenfor CellarProvider');
  return v;
}

// ─── Kø ──────────────────────────────────────────────────────

export const usePending = () => useSyncExternalStore(queue.subscribe, queue.get, queue.get);

/** Sender køen når appen er på nett og i forgrunnen. */
export function useQueueRunner(onError: (msg: string) => void, enabled: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    // Uten økt ville kallene feilet med «forbidden» og operasjonene blitt forkastet.
    if (!enabled) return;
    const go = () =>
      flush(
        async (op) => {
          await Promise.all([
            qc.invalidateQueries({ queryKey: ['history', op.cellar_id] }),
            qc.invalidateQueries({ queryKey: ['wines', op.cellar_id] }),
          ]);
          qc.invalidateQueries({ queryKey: ['cellars'] });
        },
        (e) => {
          onError(e.message);
          qc.invalidateQueries({ queryKey: ['wines', e.op.cellar_id] });
        },
      );
    queue.load().then(go);
    // Prøv ved hver nettverksendring; flush() stopper av seg selv hvis vi fortsatt er offline.
    // På web sjekker NetInfo tilgjengelighet mot en ekstern URL, så lytt også på «online».
    const unsubNet = NetInfo.addEventListener(() => go());
    const onOnline = () => go();
    if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('online', onOnline);
    const app = AppState.addEventListener('change', (s) => { if (s === 'active') go(); });
    const unsubQ = queue.subscribe(() => { if (queue.get().length) go(); });
    const iv = setInterval(go, 30_000);
    return () => {
      unsubNet(); app.remove(); unsubQ(); clearInterval(iv);
      if (typeof window !== 'undefined' && window.removeEventListener) window.removeEventListener('online', onOnline);
    };
  }, [qc, onError, enabled]);
}

// ─── Historikk og beholdning ─────────────────────────────────

export type HistoryRow = { id: string; client_id: string | null; dir: 'in' | 'out'; qty: number; created_at: string; wine: Wine; pending: boolean };

function useServerHistory(cellarId?: string) {
  return useQuery({
    queryKey: ['history', cellarId],
    enabled: !!cellarId,
    queryFn: async () => {
      const { data, error } = await supabase.from('movements')
        .select('id,client_id,dir,qty,created_at,product:products(*)')
        .eq('cellar_id', cellarId!).order('created_at', { ascending: false }).limit(300);
      if (error) throw error;
      return (data ?? []).map((m: any): HistoryRow => ({
        id: m.id, client_id: m.client_id, dir: m.dir, qty: m.qty, created_at: m.created_at, wine: productToWine(m.product), pending: false,
      }));
    },
  });
}

/** Ventende operasjoner som serveren ikke har sett ennå (dedup på client_id). */
function useUnseenOps(cellarId?: string) {
  const pending = usePending();
  const hist = useServerHistory(cellarId);
  return useMemo(() => {
    const seen = new Set((hist.data ?? []).map((h) => h.client_id).filter(Boolean));
    return pending.filter((o) => o.cellar_id === cellarId && !seen.has(o.client_id));
  }, [pending, hist.data, cellarId]);
}

export function useHistory(cellarId?: string) {
  const q = useServerHistory(cellarId);
  const unseen = useUnseenOps(cellarId);
  const rows = useMemo<HistoryRow[]>(() => [
    ...unseen.slice().reverse().map((o) => ({ id: o.client_id, client_id: o.client_id, dir: o.dir, qty: o.qty, created_at: o.at, wine: o.wine, pending: true })),
    ...(q.data ?? []),
  ], [q.data, unseen]);
  return { ...q, rows };
}

function applyOps(wines: Wine[], ops: Op[]) {
  let ws = wines;
  for (const o of ops) {
    const d = o.dir === 'in' ? o.qty : -o.qty;
    const hit = ws.find((w) => w.nr === o.wine.nr);
    ws = hit ? ws.map((w) => (w === hit ? { ...w, qty: w.qty + d } : w)) : d > 0 ? [...ws, { ...o.wine, qty: d }] : ws;
  }
  return ws.filter((w) => w.qty > 0);
}

export function useWines(cellarId?: string) {
  const q = useQuery({
    queryKey: ['wines', cellarId],
    enabled: !!cellarId,
    queryFn: async () => {
      const { data, error } = await supabase.from('cellar_items')
        .select('qty,drink_from,drink_to,product:products(*)')
        .eq('cellar_id', cellarId!).gt('qty', 0);
      if (error) throw error;
      return (data ?? []).map((i: any) => productToWine(i.product, i));
    },
  });
  const unseen = useUnseenOps(cellarId);
  const wines = useMemo(() => applyOps(q.data ?? [], unseen), [q.data, unseen]);
  return { ...q, wines };
}

// ─── Vinmonopolet-status ─────────────────────────────────────

export function useVmpStatus(enabled: boolean) {
  return useQuery({
    queryKey: ['vmp-status'],
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: () => vmp.ping(),
  });
}

// ─── Deling ──────────────────────────────────────────────────

export type Person = { email: string; role: 'owner' | 'member'; pending: boolean; is_me: boolean };

export function usePeople(cellarId?: string) {
  return useQuery({
    queryKey: ['people', cellarId],
    enabled: !!cellarId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('cellar_people', { p_cellar: cellarId });
      if (error) throw error;
      return (data ?? []) as Person[];
    },
  });
}
