// Lokal etterligning av apis.vinmonopolet.no/products/v0/details-normal for tester.
// Svarer som det ekte API-et (bare basic + lastChanged) og avviser mellomrom.
import { readFileSync } from 'node:fs';
import http from 'node:http';

export const PRODUCTS = [
  ['9422102', 'Charles Smith Kung Fu Girl Riesling 2020'],
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

// Finnes bare på vinmonopolet.no, ikke i det offisielle API-et (f.eks. utgått eller bestillingsutvalg).
export const WEB_ONLY = [['12345601', 'Domaine Utgått Syrah 2018']];

export function startMockVmp(port = 8787) {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    // api.anthropic.com/v1/messages for vinrådgiveren (ANTHROPIC_BASE_URL peker hit i lokale tester).
    // Velger de to første vinene i listen og en id som ikke finnes, så filtreringen i funksjonen testes.
    if (u.pathname === '/v1/messages' && req.method === 'POST') {
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => {
        const body = JSON.parse(raw || '{}');
        const system = typeof body.system === 'string' ? body.system : '';
        const ids = [...system.matchAll(/^(v\d+): ([^·\n]+)/gm)].map((m) => [m[1], m[2].trim()]);
        const picks = [...ids.slice(0, 2).map(([id, name]) => ({ id, reason: `${name} passer godt (testsvar).` })), { id: 'v999', reason: 'finnes ikke' }];
        const answer = { summary: `Til «${body.messages?.[0]?.content}» foreslår jeg disse (testsvar).`, picks };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: 'msg_mock', type: 'message', role: 'assistant', model: body.model, stop_reason: 'end_turn', stop_sequence: null,
          content: [{ type: 'text', text: JSON.stringify(answer) }],
          usage: { input_tokens: 1, output_tokens: 1 },
        }));
      });
      return;
    }
    // vinmonopolet.no/vmpws/v3/vmp/products/<nr> (nettstedets eget API, svarer med XML)
    const web = u.pathname.match(/^\/vmpws\/v3\/vmp\/products\/(\d+)$/);
    if (web) {
      if (web[1] === '9422102') {
        res.writeHead(200, { 'Content-Type': 'application/xml' });
        return res.end(readFileSync(new URL('./fixtures/vmpweb-9422102.xml', import.meta.url)));
      }
      const hit = [...PRODUCTS, ...WEB_ONLY].find(([nr]) => nr === web[1]);
      if (!hit) { res.writeHead(400); return res.end('<errorList><errors><message>Det har oppstått en feil.</message><type>VmpError</type></errors></errorList>'); }
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      return res.end(`<product><code>${hit[0]}</code><name>${hit[1]}</name><main_category><code>rødvin</code><name>Rødvin</name></main_category><main_country><name>Italia</name></main_country><price><value>689</value></price><year>${(hit[1].match(/(19|20)\d\d/) || [''])[0]}</year></product>`);
    }
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
