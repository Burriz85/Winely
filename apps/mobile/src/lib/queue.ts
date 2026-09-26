// Offline-kø for inn/ut. Hver registrering får en client_id, så register_movement()
// er idempotent: kjøres samme operasjon to ganger, telles den bare én gang.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Wine } from '@vinskap/shared';
import { supabase } from './supabase';

export type Op = {
  client_id: string;
  cellar_id: string;
  dir: 'in' | 'out';
  qty: number;
  at: string;
  /** Øyeblikksbilde for visning mens operasjonen venter. */
  wine: Wine;
  /** Ny vin i skapet: opprett/fyll ut produktet og sett drikkevindu. */
  isNew: boolean;
  /** Strekkoden som skal kobles til vinen (ukjent strekkode eller «Feil vin?»). */
  ean?: string;
};

const KEY = 'vinskap.queue';
let ops: Op[] = [];
let loaded = false;
let flushing: Promise<void> | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());
const save = () => AsyncStorage.setItem(KEY, JSON.stringify(ops)).catch(() => {});

export const queue = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => ops,
  async load() {
    if (loaded) return;
    loaded = true;
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) ops = [...JSON.parse(raw), ...ops];
    } catch {}
    emit();
  },
  add(op: Op) {
    ops = [...ops, op];
    save();
    emit();
  },
  remove(id: string) {
    ops = ops.filter((o) => o.client_id !== id);
    save();
    emit();
  },
  clear() {
    ops = [];
    save();
    emit();
  },
};

export const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

/** Feil fra Postgres (har SQLSTATE) er varige. Nettverksfeil prøves igjen senere. */
export class PermanentError extends Error {
  constructor(message: string, public op: Op) { super(message); }
}

type PgError = { code?: string; message: string };
const isPermanent = (e: PgError) => !!e.code && /^[0-9A-Z]{5}$|^PGRST/.test(e.code);

function explain(e: PgError, op: Op) {
  if (e.code === '23514') return 'Du har ikke så mange flasker av ' + op.wine.name + '.';
  if (e.message.includes('forbidden')) return 'Kontoen din kan ikke registrere flasker.';
  return 'Kunne ikke lagre: ' + e.message;
}

async function run(op: Op) {
  const w = op.wine;
  let pid = w.productId;
  const fail = (e: PgError) => {
    throw isPermanent(e) ? new PermanentError(explain(e, op), op) : new Error(e.message);
  };
  if (!pid || op.isNew) {
    const { data, error } = await supabase.rpc('ensure_product', {
      p_vmp_nr: w.nr, p_name: w.name, p_type: w.type, p_vintage: w.year, p_price: w.price || null,
    });
    if (error) fail(error);
    pid = data as string;
  }
  if (op.ean) {
    const { error } = await supabase.rpc('suggest_ean', { p_ean: op.ean, p_product: pid });
    if (error) fail(error);
  }
  const { error } = await supabase.rpc('register_movement', {
    p_cellar: op.cellar_id, p_product: pid, p_dir: op.dir, p_qty: op.qty, p_client_id: op.client_id,
  });
  if (error) fail(error);
  if (op.isNew && op.dir === 'in') {
    const { error: e2 } = await supabase.from('cellar_items')
      .update({ drink_from: w.from, drink_to: w.to })
      .eq('cellar_id', op.cellar_id).eq('product_id', pid);
    if (e2) fail(e2);
  }
}

/**
 * Sender ventende operasjoner i rekkefølge. Stopper ved første nettverksfeil.
 * `afterEach` får kjøre (f.eks. hente data på nytt) før operasjonen fjernes fra køen,
 * så skjermen aldri viser den dobbelt eller mangler den.
 */
export function flush(afterEach: (op: Op) => Promise<void>, onPermanent: (e: PermanentError) => void) {
  if (flushing) return flushing;
  flushing = (async () => {
    await queue.load();
    for (const op of [...ops]) {
      try {
        await run(op);
      } catch (e) {
        if (e instanceof PermanentError) {
          queue.remove(op.client_id);
          onPermanent(e);
          continue;
        }
        break; // offline eller serveren svarer ikke: prøv igjen senere
      }
      await afterEach(op).catch(() => {});
      queue.remove(op.client_id);
    }
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}
