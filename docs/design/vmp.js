// Vinmonopolet API client (api.vinmonopolet.no, Azure APIM).
// I produksjon: kall via egen backend/proxy så nøkkelen ikke ligger i appen.
window.VMP = (function () {
  const BASE = 'https://apis.vinmonopolet.no';
  const KEY_LS = 'vinskap.vmpKey';
  const PROXY_LS = 'vinskap.vmpProxy';
  const getKey = () => localStorage.getItem(KEY_LS) || '';
  const getProxy = () => localStorage.getItem(PROXY_LS) || '';
  const setKey = k => localStorage.setItem(KEY_LS, k || '');
  const setProxy = p => localStorage.setItem(PROXY_LS, p || '');

  async function call(path, params) {
    const base = getProxy() || BASE;
    const url = new URL(base.replace(/\/$/, '') + path);
    Object.entries(params || {}).forEach(([k, v]) => v != null && v !== '' && url.searchParams.set(k, v));
    const headers = {};
    if (getKey()) headers['Ocp-Apim-Subscription-Key'] = getKey();
    let res;
    try { res = await fetch(url.toString(), { headers }); }
    catch (e) { throw new Error('Nettverk/CORS blokkerte kallet. Bruk en proxy (se innstillinger).'); }
    if (res.status === 401 || res.status === 403) throw new Error('Ugyldig eller manglende API-nøkkel (' + res.status + ').');
    if (!res.ok) throw new Error('Vinmonopolet svarte ' + res.status + '.');
    return res.json();
  }

  const TYPE = t => {
    t = (t || '').toLowerCase();
    if (t.includes('rød')) return 'Rødvin';
    if (t.includes('hvit')) return 'Hvitvin';
    if (t.includes('muss') || t.includes('champ')) return 'Musserende';
    if (t.includes('rosé') || t.includes('rose')) return 'Rosévin';
    return 'Rødvin';
  };

  // Det åpne details-normal-endepunktet gir kun { basic:{productId, productShortName}, lastChanged }.
  // Resten (type, årgang, drikkevindu, pris) fylles inn av brukeren. Bilde: bilder.vinmonopolet.no (kun <img>, ikke fetch/CORS).
  const img = id => id ? 'https://bilder.vinmonopolet.no/cache/300x300-0/' + id + '-1.jpg' : '';
  const guessYear = s => { const m = (s || '').match(/\b(19[5-9]\d|20[0-4]\d)\b/); return m ? +m[1] : null; };
  function normalize(p) {
    const b0 = p.basic || {};
    if (!p.classification && !p.origins) {
      const y = new Date().getFullYear(), yr = guessYear(b0.productShortName);
      return { id: null, nr: String(b0.productId || ''), name: b0.productShortName || 'Ukjent', producer: '', year: yr, type: null,
        country: '', region: '', grape: '—', abv: '—', price: 0, taste: '', food: '—', qty: 0, from: y, to: y + 5, img: img(b0.productId), ean: [] };
    }
    const b = p.basic || {}, c = p.classification || {}, o = (p.origins && p.origins.origin) || {};
    const ing = p.ingredients || {}, d = p.description || {};
    const grapes = (ing.grapes || []).map(g => g.grapeDesc || g.name).filter(Boolean).join(', ');
    const vintage = parseInt(b.vintage, 10);
    const year = vintage > 1900 ? vintage : null;
    return {
      id: null,
      nr: String(b.productId || ''),
      name: b.productShortName || b.productLongName || 'Ukjent',
      producer: (p.logistics && p.logistics.manufacturerName) || b.manufacturerName || '',
      year,
      type: TYPE(c.subProductTypeName || c.mainProductTypeName || c.productTypeName),
      country: o.country || '',
      region: o.region || o.subRegion || '',
      grape: grapes || '—',
      abv: b.alcoholContent != null ? String(b.alcoholContent).replace('.', ',') + ' %' : '—',
      price: 0,
      taste: [d.characteristics && d.characteristics.colour, d.characteristics && d.characteristics.odour, d.characteristics && d.characteristics.taste].filter(Boolean).join(' '),
      food: ((d.recommendedFood || []).map(f => f.foodDesc).filter(Boolean).join(' · ')) || '—',
      qty: 0,
      from: year ? year + 2 : new Date().getFullYear(),
      to: year ? year + 10 : new Date().getFullYear() + 5,
      img: img(b.productId),
      ean: (p.barcodes || p.gtins || []).map(x => x.gtin || x.barcode || x).filter(Boolean)
    };
  }

  // products-v0 har ingen pris-operasjon; pris registreres manuelt eller hentes fra annen kilde.

  async function search(q) {
    const r = await call('/products/v0/details-normal', { productShortNameContains: q, maxResults: 20 });
    return (Array.isArray(r) ? r : []).map(normalize);
  }
  async function byId(productId) {
    const r = await call('/products/v0/details-normal', { productId });
    const p = Array.isArray(r) && r[0] ? normalize(r[0]) : null;
    return p;
  }

  return { getKey, setKey, getProxy, setProxy, search, byId, normalize, configured: () => !!(getKey() || getProxy()) };
})();
