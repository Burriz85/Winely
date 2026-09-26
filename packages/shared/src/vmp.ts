// Klient for Vinmonopolet products/v0 via egen proxy (supabase/functions/vmp).
// Nøkkelen ligger på serveren. Klienten sender bare brukerens Supabase-token.
import { defaultWindow, guessYear } from './format';
import type { Wine } from './types';

export const vmpImage = (nr: string | number | null | undefined, size: 300 | 515 = 300) =>
  nr ? `https://bilder.vinmonopolet.no/cache/${size}x${size}-0/${nr}-1.jpg` : '';

export const vmpProductUrl = (nr: string) => 'https://www.vinmonopolet.no/p/' + nr;

/** API-et avviser mellomrom («No spaces …»). Handoff: erstatt med `_`. */
export const toSearchTerm = (q: string) => q.trim().replace(/\s+/g, '_');

export type VmpRaw = { basic?: { productId?: string | number; productShortName?: string }; lastChanged?: { date?: string; time?: string } };

/** details-normal gir bare varenr. og navn. Resten fylles inn av brukeren. */
export function normalize(p: VmpRaw, now = new Date().getFullYear()): Wine {
  const b = p.basic || {};
  const nr = b.productId != null ? String(b.productId) : '';
  const name = b.productShortName || 'Ukjent';
  const year = guessYear(name);
  const w = defaultWindow(year, now);
  return {
    productId: null, nr, name, producer: '', year, type: null, country: '', region: '', grape: '',
    abv: '', price: 0, taste: '', food: '', qty: 0, from: w.from, to: w.to, img: vmpImage(nr),
  };
}

export class VmpError extends Error {
  constructor(message: string, public status?: number) { super(message); }
}

export type VmpClientOptions = {
  /** https://<prosjekt>.supabase.co/functions/v1/vmp */
  baseUrl: string;
  /** Authorization + apikey for Supabase. */
  headers: () => Promise<Record<string, string>> | Record<string, string>;
  fetch?: typeof fetch;
};

export function createVmpClient(opts: VmpClientOptions) {
  const f = opts.fetch ?? fetch;

  async function call(params: Record<string, string | number | undefined>) {
    // Bygger spørringen selv: URL/URLSearchParams er ufullstendig i noen React Native-versjoner.
    const qs = Object.entries(params)
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v)))
      .join('&');
    const url = opts.baseUrl.replace(/\/$/, '') + '/products/v0/details-normal' + (qs ? '?' + qs : '');
    let res: Response;
    const t0 = Date.now();
    try {
      res = await f(url, { headers: await opts.headers() });
    } catch {
      throw new VmpError('Fikk ikke kontakt med Vinmonopolet. Sjekk nettet.');
    }
    if (res.status === 401 || res.status === 403) throw new VmpError('Ingen tilgang til Vinmonopolet-proxyen (' + res.status + ').', res.status);
    if (res.status === 429) throw new VmpError('For mange kall til Vinmonopolet. Prøv igjen om litt.', 429);
    if (!res.ok) throw new VmpError('Vinmonopolet svarte ' + res.status + '.', res.status);
    const data = await res.json();
    return { rows: (Array.isArray(data) ? data : []) as VmpRaw[], ms: Date.now() - t0 };
  }

  return {
    async search(q: string, maxResults = 20) {
      const term = toSearchTerm(q);
      if (!term) return [];
      const { rows } = await call({ productShortNameContains: term, maxResults });
      return rows.map((r) => normalize(r));
    },
    async byId(nr: string) {
      const { rows } = await call({ productId: nr });
      return rows[0] ? normalize(rows[0]) : null;
    },
    /** Lett kall for statuspillen og «Test tilkobling nå». */
    async ping(source?: 'test') {
      const { ms } = await call({ maxResults: 1, _source: source });
      return ms;
    },
  };
}

export type VmpClient = ReturnType<typeof createVmpClient>;
