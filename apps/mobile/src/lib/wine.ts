import type { Wine } from '@vinskap/shared';

export const yr = (w: Pick<Wine, 'year'>) => (w.year ? String(w.year) : 'NV');
/** «Produsent · 2017 · Piemonte» uten tomme ledd. */
export const sub = (w: Wine) => [w.producer, yr(w), w.region].filter(Boolean).join(' · ');
