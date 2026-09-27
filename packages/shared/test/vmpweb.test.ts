import { readFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { describe, expect, it } from 'vitest';
import { normalizeDetails } from '../../../supabase/functions/_shared/vmpweb';

// Svaret fra vinmonopolet.no/vmpws/v3/vmp/products/9422102?fields=FULL, hentet 27.09.2026.
const xml = readFileSync(new URL('../../../tests/fixtures/vmpweb-9422102.xml', import.meta.url), 'utf8');

describe('vinmonopolet.no-produktdata', () => {
  it('normaliserer XML-svaret', () => {
    const d = normalizeDetails(new XMLParser({ parseTagValue: false, ignoreAttributes: true }).parse(xml));
    expect(d).toEqual({
      vmp_nr: '9422102',
      name: 'Charles Smith Kung Fu Girl Riesling 2020',
      producer: 'Charles Smith',
      vintage: 2020,
      type: 'Hvitvin',
      country: 'USA',
      region: 'Washington, Columbia Valley',
      grapes: ['Riesling 98%', 'Sauvignon Blanc 2%'],
      abv: 12,
      price: 49.5,
      volume_cl: 37.5,
      taste: 'Ørlite utviklet, preg av sitrus, eple og litt krydder, hint av mineraler i ettersmak.',
      food: 'Skalldyr · Fisk · Ost',
      status: 'utgatt',
    });
  });

  it('tåler JSON med samme feltnavn, og manglende felt', () => {
    expect(normalizeDetails({ code: '1', name: 'X', main_category: { code: 'rødvin', name: 'Rødvin' }, price: { value: 199 } }))
      .toMatchObject({ vmp_nr: '1', type: 'Rødvin', price: 199, grapes: null, abv: null });
    expect(normalizeDetails({ code: '2', main_category: { code: 'sterkvin', name: 'Sterkvin' } })?.type).toBeNull();
    expect(normalizeDetails({ errors: [] })).toBeNull();
  });
});
