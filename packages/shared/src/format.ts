import { C } from './theme';

/** «kr 12 345» med mellomrom som tusenskille. */
export const kr = (n: number | null | undefined) =>
  'kr ' + String(Math.round(n ?? 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export type DrinkStatus = { label: string; color: string; ready: boolean };

/** Drikkestatus slik prototypen regner den: bare år, ikke dato. */
export function drinkStatus(from: number, to: number, now = new Date().getFullYear()): DrinkStatus {
  if (now < from) return { label: 'Lagres til ' + from, color: C.coalSoft, ready: false };
  if (now >= to) return { label: 'Drikk nå · siste år', color: C.red, ready: true };
  return { label: 'Drikk nå · til ' + to, color: C.honeyText, ready: true };
}

/** Standard drikkevindu når bare årgangen er kjent (prototypen: +2 til +10, NV: i år til +5). */
export function defaultWindow(year: number | null, now = new Date().getFullYear()) {
  return year ? { from: year + 2, to: year + 10 } : { from: now, to: now + 5 };
}

/** Gjett årgang fra produktnavnet (regex 19xx|20xx fra handoff). */
export const guessYear = (s: string | null | undefined): number | null => {
  const m = (s || '').match(/\b(19[5-9]\d|20[0-4]\d)\b/);
  return m ? +m[1] : null;
};

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];
const pad = (n: number) => String(n).padStart(2, '0');
const dayDiff = (d: Date, now: Date) =>
  Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000,
  );

/**
 * Relativ tid.
 *  app   (sep ' · ', alltid klokkeslett): «I dag · 09:14», «I går · 19:42», «12. sep · 14:10»
 *  admin (sep ' ', klokkeslett bare i dag/i går): «I dag 09:14», «I går 21:40», «22. sep»
 */
export function relTime(input: string | Date | null | undefined, style: 'app' | 'admin' = 'app', now = new Date()) {
  if (!input) return '—';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(d.getTime())) return '—';
  const t = pad(d.getHours()) + ':' + pad(d.getMinutes());
  const diff = dayDiff(d, now);
  const day = diff === 0 ? 'I dag' : diff === 1 ? 'I går' : d.getDate() + '. ' + MONTHS[d.getMonth()] +
    (d.getFullYear() !== now.getFullYear() ? ' ' + d.getFullYear() : '');
  if (style === 'admin') return diff <= 1 ? day + ' ' + t : day;
  return day + ' · ' + t;
}

/** «2026-03-02» → «2. mar 2026» */
export function shortDate(input: string | Date | null | undefined) {
  if (!input) return '—';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(d.getTime())) return '—';
  return d.getDate() + '. ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
}

export const isEmail = (s: string) => /^\S+@\S+\.\S+$/.test(s.trim());

/** Fornavn med stor forbokstav for initial-knappen. */
export const initial = (name: string | null | undefined, email?: string | null) =>
  ((name || '').trim().charAt(0) || (email || '?').charAt(0)).toUpperCase();
