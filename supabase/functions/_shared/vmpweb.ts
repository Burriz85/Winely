// Produktdata fra vinmonopolet.no sitt eget nettsted (vmpws/v3). IKKE et offisielt API:
// det kan endres eller stenges uten varsel, så alt her er «best effort» og valgfritt.
// Ren TypeScript uten Deno-API-er, så den kan enhetstestes med vitest.

export type VmpDetails = {
  vmp_nr: string;
  name: string | null;
  producer: string | null;
  vintage: number | null;
  type: 'Rødvin' | 'Hvitvin' | 'Musserende' | 'Rosévin' | null;
  country: string | null;
  region: string | null;
  grapes: string[] | null;
  abv: number | null;
  price: number | null;
  volume_cl: number | null;
  taste: string | null;
  food: string | null;
  status: string | null;
};

type Obj = Record<string, any>;
const arr = <T>(x: T | T[] | undefined | null): T[] => (x == null ? [] : Array.isArray(x) ? x : [x]);
const str = (x: unknown) => (x == null || x === '' ? null : String(x).trim() || null);
const num = (x: unknown) => {
  if (x == null || x === '') return null;
  const n = Number(String(x).replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
};

const TYPE: Record<string, VmpDetails['type']> = {
  rodvin: 'Rødvin', 'rødvin': 'Rødvin', hvitvin: 'Hvitvin', musserende_vin: 'Musserende', 'musserende vin': 'Musserende',
  musserende: 'Musserende', rosevin: 'Rosévin', 'rosévin': 'Rosévin',
};

/** Tar objektet fra JSON-svaret eller fra XML-parseren (samme feltnavn). */
export function normalizeDetails(p: Obj): VmpDetails | null {
  if (!p || typeof p !== 'object') return null;
  if (p.product && typeof p.product === 'object') p = p.product;
  const nr = str(p.code);
  if (!nr) return null;
  const c: Obj = p.content ?? {};
  const cat = p.main_category ?? {};
  const typeKey = (str(cat.code) ?? str(cat.name) ?? '').toLowerCase();
  const year = num(p.year);
  const alc = arr<Obj>(c.traits).find((t) => /alkohol/i.test(String(t?.name)));
  const region = [str(p.district?.name), str(p.sub_District?.name)].filter(Boolean).join(', ') || null;
  const grapes = arr<Obj>(c.ingredients).map((i) => str(i?.formattedValue)).filter((g): g is string => !!g);
  const food = arr<Obj>(c.isGoodFor).map((f) => str(f?.name)).filter(Boolean).join(' · ') || null;
  return {
    vmp_nr: nr,
    name: str(p.name),
    producer: str(p.main_producer?.name),
    vintage: year && year > 1900 && year < 2100 ? year : null,
    type: TYPE[typeKey] ?? TYPE[(str(cat.name) ?? '').toLowerCase()] ?? null,
    country: str(p.main_country?.name),
    region,
    grapes: grapes.length ? grapes : null,
    abv: num(alc?.formattedValue ?? alc?.value),
    price: num(p.price?.value),
    volume_cl: num(p.volume?.value),
    taste: str(p.taste),
    food,
    status: str(p.status),
  };
}
