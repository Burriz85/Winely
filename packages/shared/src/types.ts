import type { WineType } from './theme';

// Rader slik de ligger i Postgres (se supabase/migrations).
export type Product = {
  id: string;
  vmp_nr: string | null;
  name: string;
  producer: string | null;
  vintage: number | null;
  type: WineType | null;
  country: string | null;
  region: string | null;
  grapes: string[] | null;
  abv: number | null;
  price: number | null;
  image_url: string | null;
  vmp_updated_at: string | null;
  taste: string | null;
  food: string | null;
  volume_cl: number | null;
  details_updated_at: string | null;
};

export type CellarItem = {
  id: string;
  cellar_id: string;
  product_id: string;
  qty: number;
  drink_from: number | null;
  drink_to: number | null;
  note: string | null;
};

export type Movement = {
  id: string;
  cellar_id: string;
  product_id: string;
  dir: 'in' | 'out';
  qty: number;
  created_by: string;
  created_at: string;
  client_id: string | null;
};

/** Vinen slik skjermene bruker den: produkt + beholdning i ett skap. */
export type Wine = {
  productId: string | null;
  nr: string;
  name: string;
  producer: string;
  year: number | null;
  type: WineType | null;
  country: string;
  region: string;
  grape: string;
  abv: string;
  price: number;
  taste: string;
  food: string;
  qty: number;
  from: number;
  to: number;
  img: string;
};
