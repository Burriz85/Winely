import type { Wine } from '@vinskap/shared';

/** Nøkkel for en vin i skapet: varenummer, eller produkt-id for viner som ikke finnes hos Vinmonopolet. */
export const wineKey = (w: Pick<Wine, 'nr' | 'productId'>) => w.nr || w.productId || '';

export const yr = (w: Pick<Wine, 'year'>) => (w.year ? String(w.year) : 'NV');
/** «Produsent · 2017 · Piemonte» uten tomme ledd. */
export const sub = (w: Wine) => [w.producer, yr(w), w.region].filter(Boolean).join(' · ');
