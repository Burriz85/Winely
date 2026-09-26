import { describe, expect, it } from 'vitest';
import { createVmpClient, defaultWindow, drinkStatus, guessYear, kr, normalize, relTime, toSearchTerm, vmpImage } from '../src';

describe('format', () => {
  it('kr', () => {
    expect(kr(9642)).toBe('kr 9 642');
    expect(kr(28310)).toBe('kr 28 310');
    expect(kr(0)).toBe('kr 0');
    expect(kr(null)).toBe('kr 0');
    expect(kr(1234567)).toBe('kr 1 234 567');
  });
  it('drikkestatus', () => {
    expect(drinkStatus(2027, 2040, 2026).label).toBe('Lagres til 2027');
    expect(drinkStatus(2024, 2035, 2026)).toMatchObject({ label: 'Drikk nå · til 2035', ready: true });
    expect(drinkStatus(2024, 2026, 2026).label).toBe('Drikk nå · siste år');
  });
  it('drikkevindu og årgang', () => {
    expect(defaultWindow(2019, 2026)).toEqual({ from: 2021, to: 2029 });
    expect(defaultWindow(null, 2026)).toEqual({ from: 2026, to: 2031 });
    expect(guessYear('Barolo Cannubi 2017')).toBe(2017);
    expect(guessYear('Brut Réserve')).toBeNull();
    expect(guessYear('Château 1945')).toBeNull();
  });
  it('relativ tid', () => {
    const now = new Date(2026, 8, 26, 12, 0);
    expect(relTime(new Date(2026, 8, 26, 9, 14), 'app', now)).toBe('I dag · 09:14');
    expect(relTime(new Date(2026, 8, 25, 19, 42), 'app', now)).toBe('I går · 19:42');
    expect(relTime(new Date(2026, 8, 12, 14, 10), 'app', now)).toBe('12. sep · 14:10');
    expect(relTime(new Date(2026, 8, 22, 8, 0), 'admin', now)).toBe('22. sep');
    expect(relTime(new Date(2026, 8, 25, 21, 40), 'admin', now)).toBe('I går 21:40');
    expect(relTime(new Date(2025, 11, 1, 8, 0), 'admin', now)).toBe('1. des 2025');
  });
});

describe('vmp', () => {
  it('søkeord uten mellomrom', () => {
    expect(toSearchTerm('  barolo  cannubi ')).toBe('barolo_cannubi');
  });
  it('normaliserer det tynne svaret', () => {
    const w = normalize({ basic: { productId: 1616601, productShortName: 'Scavino Barolo Cannubi 2019' } }, 2026);
    expect(w).toMatchObject({ nr: '1616601', year: 2019, from: 2021, to: 2029, type: null, img: vmpImage('1616601') });
  });
  it('kaller proxyen med riktige parametre', async () => {
    const calls: string[] = [];
    const client = createVmpClient({
      baseUrl: 'https://x.supabase.co/functions/v1/vmp/',
      headers: () => ({ Authorization: 'Bearer t' }),
      fetch: (async (u: string) => {
        calls.push(u);
        return new Response(JSON.stringify([{ basic: { productId: '1', productShortName: 'A' } }]), { status: 200 });
      }) as typeof fetch,
    });
    const r = await client.search('brut reserve');
    expect(r[0].nr).toBe('1');
    expect(calls[0]).toBe('https://x.supabase.co/functions/v1/vmp/products/v0/details-normal?productShortNameContains=brut_reserve&maxResults=20');
  });
  it('gir norsk feilmelding ved 429', async () => {
    const client = createVmpClient({ baseUrl: 'https://x', headers: () => ({}), fetch: (async () => new Response('', { status: 429 })) as unknown as typeof fetch });
    await expect(client.byId('1')).rejects.toThrow('For mange kall');
  });
});
