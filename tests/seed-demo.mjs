// Fyller lokal Supabase med demodata som ligner prototypens mock (wines.js / admin-data.js).
// Kjør: node tests/seed-demo.mjs   (etter `npx supabase db reset`)
// Alle brukere har passordet «vinskap-demo».
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON = process.env.SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const PW = 'vinskap-demo';
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const svc = createClient(URL, SERVICE, opts);

const ok = (r, what) => { if (r.error) throw new Error(what + ': ' + r.error.message); return r.data; };
const daysAgo = (d, h = 12, m = 0) => { const t = new Date(); t.setDate(t.getDate() - d); t.setHours(h, m, 0, 0); return t.toISOString(); };

async function user(email, name, { admin = false, confirmed = true } = {}) {
  const u = ok(await svc.auth.admin.createUser({ email, password: PW, email_confirm: confirmed, user_metadata: { name } }), 'bruker ' + email);
  if (admin) ok(await svc.from('profiles').update({ is_admin: true }).eq('id', u.user.id), 'admin');
  if (!confirmed) return { id: u.user.id };
  const c = createClient(URL, ANON, opts);
  ok(await c.auth.signInWithPassword({ email, password: PW }), 'login ' + email);
  const cellar = ok(await c.from('cellars').select('id').eq('owner_id', u.user.id).single(), 'skap');
  return { id: u.user.id, c, cellar: cellar.id };
}

const W = [
  // nr, navn, type, årgang, pris, fra, til, land, distrikt, druer, alkohol
  ['1670901', 'Brezza Barolo Cannubi 2017', 'Rødvin', 2017, 689, 2024, 2035, 'Italia', 'Piemonte', ['Nebbiolo'], 14.5],
  ['8354901', 'S. Billaud Chablis Les Vaillons VV 2021', 'Hvitvin', 2021, 429, 2023, 2029, 'Frankrike', 'Burgund', ['Chardonnay'], 12.5],
  ['3761801', 'Charles Heidsieck Brut Réserve', 'Musserende', null, 599, 2024, 2028, 'Frankrike', 'Champagne', ['Pinot Noir', 'Chardonnay'], 12],
  ['563301', 'Rioja Alta Gran Reserva 904 2015', 'Rødvin', 2015, 549, 2023, 2032, 'Spania', 'Rioja', ['Tempranillo'], 13.5],
  ['315201', 'Dr. Loosen Wehlener Sonnenuhr Kab 2020', 'Hvitvin', 2020, 379, 2027, 2040, 'Tyskland', 'Mosel', ['Riesling'], 8],
  ['191401', 'Dom. du Pegau Chateauneuf du Pape Res 2019', 'Rødvin', 2019, 629, 2026, 2038, 'Frankrike', 'Rhône', ['Grenache', 'Syrah'], 14.5],
  ['2210601', "Caves d'Esclans Whispering Angel 2023", 'Rosévin', 2023, 229, 2024, 2026, 'Frankrike', 'Provence', ['Grenache', 'Cinsault'], 13],
  ['1616601', 'Paolo Scavino Barolo Cannubi 2019', 'Rødvin', 2019, 989, 2027, 2040, 'Italia', 'Piemonte', ['Nebbiolo'], 13.5],
  ['4469601', 'Louis Moreau Chablis 1er Cru Vaillons 2022', 'Hvitvin', 2022, 399, 2024, 2030, 'Frankrike', 'Burgund', ['Chardonnay'], 12.5],
];

const pid = {};
async function products(c) {
  for (const [nr, name, type, vintage, price, , , country, region, grapes, abv] of W) {
    pid[nr] = ok(await c.rpc('ensure_product', { p_vmp_nr: nr, p_name: name, p_type: type, p_vintage: vintage, p_price: price }), 'produkt ' + nr);
    await svc.from('products').update({ country, region, grapes, abv }).eq('id', pid[nr]);
  }
}

let seq = 0;
async function move(u, cellar, nr, dir, qty, at) {
  const cid = 'seed-' + ++seq;
  ok(await u.c.rpc('register_movement', { p_cellar: cellar, p_product: pid[nr], p_dir: dir, p_qty: qty, p_client_id: cid }), 'bevegelse');
  if (at) await svc.from('movements').update({ created_at: at }).eq('client_id', cid);
  const w = W.find((x) => x[0] === nr);
  await u.c.from('cellar_items').update({ drink_from: w[5], drink_to: w[6] }).eq('cellar_id', cellar).eq('product_id', pid[nr]);
}

const admin = await user('admin@vinskap.no', 'Admin', { admin: true });
const ola = await user('ola@example.no', 'Ola Nordmann');
const kari = await user('kari@example.no', 'Kari Nordmann');
const per = await user('per.hansen@example.no', 'Per Hansen');
const sofie = await user('sofie@example.no', 'Sofie Lie');
const lars = await user('lars.moe@example.no', 'Lars Moe');
await user('ingrid@example.no', 'Ingrid Berg', { confirmed: false });
await svc.from('service_invites').insert({ email: 'ingrid@example.no', name: 'Ingrid Berg', invited_by: admin.id });

await products(ola.c);
ok(await ola.c.from('cellars').update({ name: 'Hjemme' }).eq('id', ola.cellar), 'navn');
ok(await ola.c.rpc('invite_to_cellar', { p_cellar: ola.cellar, p_email: 'kari@example.no' }), 'del');
await move(ola, ola.cellar, '3761801', 'in', 4, daysAgo(29, 11, 3));
await move(ola, ola.cellar, '1670901', 'in', 3, daysAgo(29, 11, 5));
await move(ola, ola.cellar, '8354901', 'in', 3, daysAgo(19, 18, 30));
await move(kari, ola.cellar, '8354901', 'out', 1, daysAgo(19, 18, 30));
await move(ola, ola.cellar, '315201', 'in', 3, daysAgo(14, 14, 10));
await move(ola, ola.cellar, '563301', 'in', 3, daysAgo(10, 12, 0));
await move(ola, ola.cellar, '191401', 'in', 1, daysAgo(6, 20, 0));
await move(ola, ola.cellar, '2210601', 'in', 2, daysAgo(3, 17, 0));
await move(ola, ola.cellar, '563301', 'out', 1, daysAgo(1, 19, 42));

ok(await per.c.from('cellars').update({ name: 'Kjelleren' }).eq('id', per.cellar), 'navn');
await move(per, per.cellar, '1616601', 'in', 6, daysAgo(4, 15, 0));
await move(per, per.cellar, '3761801', 'in', 3, daysAgo(12, 15, 0));
await move(sofie, sofie.cellar, '4469601', 'in', 6, daysAgo(7, 16, 0));
ok(await lars.c.from('cellars').update({ name: 'Hytta' }).eq('id', lars.cellar), 'navn');
await move(lars, lars.cellar, '2210601', 'in', 6, daysAgo(85, 16, 0));

// Strekkoder, én konflikt
const map = [['8002235013826', '1670901', ola], ['3185370000335', '3761801', ola], ['8410415520018', '563301', per], ['3760062190017', '8354901', sofie], ['3700000123456', '2210601', lars]];
for (const [ean, nr, u] of map) ok(await u.c.rpc('suggest_ean', { p_ean: ean, p_product: pid[nr] }), 'ean');
ok(await sofie.c.rpc('suggest_ean', { p_ean: '3760062190017', p_product: pid['4469601'] }), 'konflikt');
for (const [ean, n] of [['8002235013826', 4], ['3185370000335', 6], ['8410415520018', 3], ['3760062190017', 2], ['3700000123456', 9]]) {
  await svc.from('ean_map').update({ hits: n }).eq('ean', ean);
}

// Skann siste 14 dager
const perDay = [18, 24, 11, 30, 42, 27, 35, 22, 19, 48, 31, 26, 39, 44];
const users = [ola, kari, per, sofie];
const scans = [];
perDay.forEach((n, i) => { for (let k = 0; k < n; k++) scans.push({ user_id: users[k % 4].id, ean: map[k % 5][0], hit: true, at: daysAgo(13 - i, 8 + (k % 12), k % 60) }); });
ok(await svc.from('scan_events').insert(scans), 'skann');

// Et manuelt produkt uten varenummer → duplikat
const manual = ok(await svc.from('products').insert({ name: 'Charles Heidsieck Brut Réserve (manuell)', type: 'Musserende' }).select('id').single(), 'manuell');
ok(await svc.from('cellar_items').insert({ cellar_id: per.cellar, product_id: manual.id, qty: 2 }), 'manuell beholdning');

// Deaktiver Lars som admin-funksjonen ville gjort
ok(await svc.auth.admin.updateUserById(lars.id, { ban_duration: '876000h' }), 'ban');
ok(await svc.from('profiles').update({ status: 'deaktivert' }).eq('id', lars.id), 'deaktiver');

// Adminhendelser og API-helse
await svc.from('audit_log').insert([
  { actor: admin.id, kind: 'admin', action: 'Inviterte', target: 'ingrid@example.no', created_at: daysAgo(0, 8, 2) },
  { actor: admin.id, kind: 'admin', action: 'Nullstilte passord for', target: 'per.hansen@example.no', created_at: daysAgo(6, 10, 0) },
  { actor: admin.id, kind: 'admin', action: 'Deaktiverte', target: 'lars.moe@example.no', created_at: daysAgo(85, 9, 0) },
]);
const health = [];
for (let i = 0; i < 60; i++) health.push({ status: 200, latency_ms: 150 + (i % 7) * 11, source: 'proxy', at: new Date(Date.now() - i * 20 * 60_000).toISOString() });
health.push({ status: 429, latency_ms: 90, error: '429 Too Many Requests', source: 'proxy', at: daysAgo(0, 1, 3) });
health.push({ status: 200, latency_ms: 640, source: 'sync', at: daysAgo(0, 3, 0) });
ok(await svc.from('api_health').insert(health), 'api');

console.log('Demodata lagt inn. Logg inn som admin@vinskap.no eller ola@example.no med passordet «' + PW + '».');
