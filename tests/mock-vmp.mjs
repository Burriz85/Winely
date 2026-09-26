// Lokal etterligning av apis.vinmonopolet.no/products/v0/details-normal for tester.
// Svarer som det ekte API-et (bare basic + lastChanged) og avviser mellomrom.
import http from 'node:http';

export const PRODUCTS = [
  ['1670901', 'Brezza Barolo Cannubi 2017'],
  ['8354901', 'S. Billaud Chablis Les Vaillons VV 2021'],
  ['3761801', 'Charles Heidsieck Brut Réserve'],
  ['563301', 'Rioja Alta Gran Reserva 904 2015'],
  ['315201', 'Dr. Loosen Wehlener Sonnenuhr Kab 2020'],
  ['191401', 'Dom. du Pegau Chateauneuf du Pape Res 2019'],
  ['2210601', "Caves d'Esclans Whispering Angel 2023"],
  ['1616601', 'Paolo Scavino Barolo Cannubi 2019'],
  ['4469601', 'Louis Moreau Chablis 1er Cru Vaillons 2022'],
];

export function startMockVmp(port = 8787) {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname !== '/products/v0/details-normal') { res.writeHead(404); return res.end(); }
    if (!req.headers['ocp-apim-subscription-key']) { res.writeHead(401); return res.end('{"statusCode":401}'); }
    const q = u.searchParams.get('productShortNameContains');
    if (q && /\s/.test(q)) { res.writeHead(400); return res.end('No spaces allowed'); }
    const id = u.searchParams.get('productId');
    const max = Number(u.searchParams.get('maxResults') || 100);
    const start = Number(u.searchParams.get('start') || 0);
    let rows = PRODUCTS;
    if (id) rows = rows.filter(([nr]) => nr === id);
    if (q) rows = rows.filter(([, n]) => n.toLowerCase().includes(q.toLowerCase().replace(/_/g, ' ')));
    const body = rows.slice(start, start + max).map(([nr, name]) => ({
      basic: { productId: nr, productShortName: name }, lastChanged: { date: '2026-09-25', time: '03:00:00' },
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  });
  return new Promise((r) => server.listen(port, '0.0.0.0', () => r(server)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await startMockVmp(Number(process.env.PORT || 8787));
  console.log('mock-vmp på :' + (process.env.PORT || 8787));
}
