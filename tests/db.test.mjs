// Integrasjonstester mot lokal Supabase (handoff-oppgave 8: test RLS).
// Forutsetter: `npx supabase start`, `node tests/mock-vmp.mjs` og
// `npx supabase functions serve --env-file supabase/functions/.env` (se README).
// Kjør: npm run test:db
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON = process.env.SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const run = Date.now().toString(36);
const mail = (n) => `${n}.${run}@test.no`;
const PW = 'hemmelig-passord-1';
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(URL, SERVICE, opts);
const anonClient = () => createClient(URL, ANON, opts);

async function signedIn(email, password = PW) {
  const c = anonClient();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

async function create(c, email, name, password = PW) {
  const r = await invoke(c, 'admin-users', { action: 'create', email, name, password });
  assert.equal(r.error, null, 'create ' + email + ': ' + r.error);
  return signedIn(email, password);
}

const invoke = async (c, fn, body) => {
  const { data, error } = await c.functions.invoke(fn, { body });
  if (!error) return { data, error: null, status: 200 };
  const text = await error.context?.text?.().catch(() => '');
  return { data, error: `${error.context?.status} ${text}`, status: error.context?.status };
};

let admin, ola, kari, per;
let olaCellar, productA, productB;
const EAN = '70' + String(Date.now()).slice(-11);

before(async () => {
  const { data, error } = await service.auth.admin.createUser({ email: mail('admin'), password: PW, email_confirm: true, user_metadata: { name: 'Admin' } });
  assert.ifError(error);
  await service.from('profiles').update({ is_admin: true }).eq('id', data.user.id);
  admin = await signedIn(mail('admin'));
});

describe('pålogging og brukere', () => {
  it('åpen registrering er stengt', async () => {
    const { error } = await anonClient().auth.signUp({ email: mail('fremmed'), password: PW });
    assert.ok(error, 'signUp skulle feilet');
  });

  it('admin oppretter brukere med passord; brukernavn uten @ virker', async () => {
    ola = await create(admin, mail('ola'), 'Ola Nordmann');
    kari = await create(admin, mail('kari'), 'Kari Nordmann');
    per = await create(admin, `per${run}@vinskap.local`, 'Per Hansen');
    const { data } = await admin.rpc('admin_users');
    const o = data.find((u) => u.email === mail('ola'));
    assert.equal(o.status, 'aktiv');
    assert.equal(o.name, 'Ola Nordmann');
    assert.equal(o.cellar_ids.length, 1, 'handle_new_user lager eget skap');
    const dup = await invoke(admin, 'admin-users', { action: 'create', email: mail('ola'), name: 'X', password: PW });
    assert.match(dup.error, /finnes allerede/);
    const short = await invoke(admin, 'admin-users', { action: 'create', email: mail('kort'), name: 'X', password: 'kort' });
    assert.match(short.error, /minst 8/);
  });

  it('vanlig bruker kan ikke gjøre seg selv til admin eller aktivere seg selv', async () => {
    const { data: { user } } = await ola.auth.getUser();
    const { error } = await ola.from('profiles').update({ is_admin: true }).eq('id', user.id);
    assert.ok(error, 'is_admin skulle vært blokkert');
    const { error: e2 } = await ola.from('profiles').update({ status: 'aktiv' }).eq('id', user.id);
    assert.ok(e2, 'status skulle vært blokkert');
    const { error: e3 } = await ola.from('profiles').update({ name: 'Ola N.' }).eq('id', user.id);
    assert.ifError(e3);
    const { data } = await ola.rpc('is_admin');
    assert.equal(data, false);
  });

  it('bare admin kan kalle admin-users og admin_users', async () => {
    const r = await invoke(ola, 'admin-users', { action: 'create', email: mail('x'), name: 'X', password: PW });
    assert.equal(r.status, 403);
    const { data } = await ola.rpc('admin_users');
    assert.deepEqual(data, []);
  });

  it('admin setter nytt passord, og brukeren kan bytte det selv', async () => {
    const { data: users } = await admin.rpc('admin_users');
    const p = users.find((u) => u.email === `per${run}@vinskap.local`);
    assert.equal((await invoke(admin, 'admin-users', { id: p.id, email: p.email, action: 'set_password', password: PW + '2' })).error, null);
    const old = await anonClient().auth.signInWithPassword({ email: p.email, password: PW });
    assert.ok(old.error, 'gammelt passord skal ikke virke');
    per = await signedIn(p.email, PW + '2');
    assert.ifError((await per.auth.updateUser({ password: PW + '3' })).error);
    per = await signedIn(p.email, PW + '3');
  });
});

describe('skap, produkter og inn/ut', () => {
  it('eier ser eget skap og registrerer atomisk og idempotent', async () => {
    const { data: cellars } = await ola.from('cellars').select('id,name');
    assert.equal(cellars.length, 1);
    olaCellar = cellars[0].id;
    assert.equal(cellars[0].name, 'Vinskapet');

    const { data: pid, error } = await ola.rpc('ensure_product', { p_vmp_nr: '1670901', p_name: 'Brezza Barolo Cannubi 2017', p_type: 'Rødvin', p_vintage: 2017, p_price: 689 });
    assert.ifError(error);
    productA = pid;
    const cid = 'c-' + run;
    const r1 = await ola.rpc('register_movement', { p_cellar: olaCellar, p_product: pid, p_dir: 'in', p_qty: 3, p_client_id: cid });
    assert.equal(r1.data, 3);
    const again = await ola.rpc('register_movement', { p_cellar: olaCellar, p_product: pid, p_dir: 'in', p_qty: 3, p_client_id: cid });
    assert.equal(again.data, 3, 'samme client_id telles ikke to ganger');
    const tooMany = await ola.rpc('register_movement', { p_cellar: olaCellar, p_product: pid, p_dir: 'out', p_qty: 5, p_client_id: cid + 'x' });
    assert.equal(tooMany.error?.code, '23514', 'kan ikke ta ut flere enn man har');
    const out = await ola.rpc('register_movement', { p_cellar: olaCellar, p_product: pid, p_dir: 'out', p_qty: 1, p_client_id: cid + 'y' });
    assert.equal(out.data, 2);
  });

  it('første registrering vinner: ensure_product overskriver ikke type/årgang/pris', async () => {
    const { data: pid } = await kari.rpc('ensure_product', { p_vmp_nr: '1670901', p_name: 'Tull', p_type: 'Hvitvin', p_vintage: 1999, p_price: 1 });
    assert.equal(pid, productA);
    const { data: p } = await ola.from('products').select('name,type,vintage,price').eq('id', pid).single();
    assert.deepEqual(p, { name: 'Brezza Barolo Cannubi 2017', type: 'Rødvin', vintage: 2017, price: 689 });
  });

  it('«Endre»: medlem retter type/årgang/pris/drikkevindu, andre kan ikke', async () => {
    const r = await ola.rpc('update_wine', { p_cellar: olaCellar, p_product: productA, p_type: 'Hvitvin', p_vintage: 2018, p_price: 700, p_from: 2025, p_to: 2030 });
    assert.ifError(r.error);
    const { data: p } = await ola.from('products').select('type,vintage,price').eq('id', productA).single();
    assert.deepEqual(p, { type: 'Hvitvin', vintage: 2018, price: 700 });
    const { data: i } = await ola.from('cellar_items').select('drink_from,drink_to').eq('cellar_id', olaCellar).eq('product_id', productA).single();
    assert.deepEqual(i, { drink_from: 2025, drink_to: 2030 });
    const bad = await ola.rpc('update_wine', { p_cellar: olaCellar, p_product: productA, p_type: 'Øl', p_vintage: null, p_price: null, p_from: null, p_to: null });
    assert.ok(bad.error);
    const other = await per.rpc('update_wine', { p_cellar: olaCellar, p_product: productA, p_type: 'Rødvin', p_vintage: 2017, p_price: 689, p_from: 2024, p_to: 2035 });
    assert.ok(other.error, 'ikke-medlem skal ikke kunne endre');
    assert.ifError((await ola.rpc('update_wine', { p_cellar: olaCellar, p_product: productA, p_type: 'Rødvin', p_vintage: 2017, p_price: 689, p_from: null, p_to: null })).error);
  });

  it('andre ser ikke skapet før det er delt', async () => {
    const { data } = await per.from('cellar_items').select('id').eq('cellar_id', olaCellar);
    assert.deepEqual(data, []);
    const ins = await per.rpc('register_movement', { p_cellar: olaCellar, p_product: productA, p_dir: 'in', p_qty: 1, p_client_id: 'p-' + run });
    assert.ok(ins.error, 'per skal ikke kunne skrive i olas skap');
    const { data: people } = await per.rpc('cellar_people', { p_cellar: olaCellar });
    assert.deepEqual(people, []);
  });

  it('deling: eier inviterer på e-post, medlem kan registrere', async () => {
    const { data: res, error } = await ola.rpc('invite_to_cellar', { p_cellar: olaCellar, p_email: mail('kari') });
    assert.ifError(error);
    assert.equal(res, 'added');
    const pending = await ola.rpc('invite_to_cellar', { p_cellar: olaCellar, p_email: mail('ukjent') });
    assert.equal(pending.data, 'invited');
    const { data: people } = await ola.rpc('cellar_people', { p_cellar: olaCellar });
    assert.deepEqual(people.map((p) => [p.email, p.role, p.pending]).sort(), [
      [mail('kari'), 'member', false], [mail('ola'), 'owner', false], [mail('ukjent'), 'member', true],
    ].sort());
    const k = await kari.rpc('register_movement', { p_cellar: olaCellar, p_product: productA, p_dir: 'in', p_qty: 2, p_client_id: 'k-' + run });
    assert.equal(k.data, 4);
    const notOwner = await kari.rpc('invite_to_cellar', { p_cellar: olaCellar, p_email: mail('per') });
    assert.ok(notOwner.error, 'medlem kan ikke invitere');
    await ola.rpc('remove_from_cellar', { p_cellar: olaCellar, p_email: mail('ukjent') });
  });
});

describe('viner som ikke finnes hos Vinmonopolet', () => {
  it('opprettes idempotent, settes inn, kobles til strekkode og kan rettes', async () => {
    const id = crypto.randomUUID();
    const args = { p_id: id, p_name: 'Château Musar 2016', p_producer: 'Musar', p_type: 'Rødvin', p_vintage: 2016, p_price: 450, p_country: 'Libanon', p_region: 'Bekaa' };
    assert.equal((await ola.rpc('create_manual_product', args)).data, id);
    assert.equal((await ola.rpc('create_manual_product', args)).data, id, 'andre gang er en no-op');
    const { data: p } = await ola.from('products').select('vmp_nr,name,type,country').eq('id', id).single();
    assert.deepEqual(p, { vmp_nr: null, name: 'Château Musar 2016', type: 'Rødvin', country: 'Libanon' });
    assert.ok((await ola.rpc('create_manual_product', { ...args, p_id: crypto.randomUUID(), p_name: ' ' })).error, 'navn kreves');

    const q = await ola.rpc('register_movement', { p_cellar: olaCellar, p_product: id, p_dir: 'in', p_qty: 2, p_client_id: 'm-' + run });
    assert.equal(q.data, 2);
    const ean = '72' + String(Date.now()).slice(-11);
    assert.equal((await ola.rpc('suggest_ean', { p_ean: ean, p_product: id })).data, 'mapped');
    assert.equal((await kari.rpc('lookup_ean', { p_ean: ean })).data[0].id, id);

    assert.ifError((await ola.rpc('update_manual_details', { p_cellar: olaCellar, p_product: id, p_name: 'Château Musar Rouge 2016', p_producer: 'Château Musar', p_country: 'Libanon', p_region: 'Bekaadalen' })).error);
    const { data: p2 } = await ola.from('products').select('name,region').eq('id', id).single();
    assert.deepEqual(p2, { name: 'Château Musar Rouge 2016', region: 'Bekaadalen' });
    const vmpEdit = await ola.rpc('update_manual_details', { p_cellar: olaCellar, p_product: productA, p_name: 'Tull', p_producer: null, p_country: null, p_region: null });
    assert.ok(vmpEdit.error, 'Vinmonopolet-viner kan ikke gis nytt navn');
    await ola.rpc('register_movement', { p_cellar: olaCellar, p_product: id, p_dir: 'out', p_qty: 2, p_client_id: 'm2-' + run });
  });

  it('druer lagres for manuelle viner', async () => {
    const id = crypto.randomUUID();
    await ola.rpc('create_manual_product', { p_id: id, p_name: 'Etikettvin', p_type: 'Hvitvin', p_grapes: ['Chenin Blanc'] });
    const { data } = await ola.from('products').select('grapes').eq('id', id).single();
    assert.deepEqual(data.grapes, ['Chenin Blanc']);
  });

  it('bilde: opplasting til wine-images og set_wine_image', async () => {
    const id = crypto.randomUUID();
    await ola.rpc('create_manual_product', { p_id: id, p_name: 'Bildevin', p_type: 'Rødvin' });
    await ola.rpc('register_movement', { p_cellar: olaCellar, p_product: id, p_dir: 'in', p_qty: 1, p_client_id: 'img-' + run });
    const path = `manual/${id}-${Date.now()}.jpg`;
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9]);
    const up = await ola.storage.from('wine-images').upload(path, jpeg, { contentType: 'image/jpeg' });
    assert.ifError(up.error);
    const url = ola.storage.from('wine-images').getPublicUrl(path).data.publicUrl;
    assert.equal((await fetch(url)).status, 200, 'offentlig lesbar');
    assert.ifError((await ola.rpc('set_wine_image', { p_cellar: olaCellar, p_product: id, p_url: url })).error);
    const { data } = await ola.from('products').select('image_url').eq('id', id).single();
    assert.equal(data.image_url, url);
    assert.ok((await ola.rpc('set_wine_image', { p_cellar: olaCellar, p_product: id, p_url: 'https://evil.example/x.jpg' })).error, 'bare egne bildeadresser');
    assert.ok((await per.rpc('set_wine_image', { p_cellar: olaCellar, p_product: id, p_url: url })).error, 'bare medlemmer');
    const outside = await ola.storage.from('wine-images').upload(`annet/${id}.jpg`, jpeg, { contentType: 'image/jpeg' });
    assert.ok(outside.error, 'bare under manual/');
    await ola.rpc('register_movement', { p_cellar: olaCellar, p_product: id, p_dir: 'out', p_qty: 1, p_client_id: 'img2-' + run });
  });

  it('etikettlesing krever innlogging, og sier fra når den ikke er satt opp', async () => {
    const anon = await fetch(`${URL}/functions/v1/label`, { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + ANON }, body: '{}' });
    assert.equal(anon.status, 403);
    const r = await invoke(ola, 'label', { image: 'aGVp' });
    // Lokalt finnes ingen ANTHROPIC_API_KEY
    assert.equal(r.status, 503);
    assert.match(r.error, /ANTHROPIC_API_KEY/);
  });
});

describe('admin knytter brukere til skap', () => {
  it('ny bruker med cellar_id blir medlem der og får ikke eget skap', async () => {
    const r = await invoke(admin, 'admin-users', { action: 'create', email: mail('lise'), name: 'Lise', password: PW, cellar_id: olaCellar });
    assert.equal(r.error, null);
    const lise = await signedIn(mail('lise'));
    const { data: cellars } = await lise.from('cellars').select('id');
    assert.deepEqual(cellars.map((c) => c.id), [olaCellar]);
    const { data: items } = await lise.from('cellar_items').select('qty').eq('cellar_id', olaCellar).eq('product_id', productA).single();
    assert.ok(items.qty > 0, 'ser samme innhold');
    const m = await lise.rpc('register_movement', { p_cellar: olaCellar, p_product: productA, p_dir: 'out', p_qty: 1, p_client_id: 'lise-' + run });
    assert.ifError(m.error);
    await lise.rpc('register_movement', { p_cellar: olaCellar, p_product: productA, p_dir: 'in', p_qty: 1, p_client_id: 'lise2-' + run });
  });

  it('ugyldig cellar_id gir vanlig eget skap', async () => {
    const r = await invoke(admin, 'admin-users', { action: 'create', email: mail('tor'), name: 'Tor', password: PW, cellar_id: '00000000-0000-0000-0000-000000000000' });
    assert.equal(r.error, null);
    const tor = await signedIn(mail('tor'));
    const { data } = await tor.from('cellar_members').select('role');
    assert.deepEqual(data, [{ role: 'owner' }]);
  });

  it('admin_set_member legger til og fjerner, men ikke eieren, og bare for admin', async () => {
    const { data: users } = await admin.rpc('admin_users');
    const perId = users.find((u) => u.email === `per${run}@vinskap.local`).id;
    const olaId = users.find((u) => u.email === mail('ola')).id;
    assert.ifError((await admin.rpc('admin_set_member', { p_cellar: olaCellar, p_user: perId, p_add: true })).error);
    const { data: seen } = await per.from('cellars').select('id').eq('id', olaCellar);
    assert.equal(seen.length, 1);
    assert.ifError((await admin.rpc('admin_set_member', { p_cellar: olaCellar, p_user: perId, p_add: false })).error);
    const { data: gone } = await per.from('cellars').select('id').eq('id', olaCellar);
    assert.equal(gone.length, 0);
    assert.ok((await admin.rpc('admin_set_member', { p_cellar: olaCellar, p_user: olaId, p_add: false })).error, 'eier kan ikke fjernes');
    assert.ok((await ola.rpc('admin_set_member', { p_cellar: olaCellar, p_user: perId, p_add: true })).error, 'bare admin');
  });
});

describe('strekkoder', () => {
  it('ukjent → forslag blir kobling → treff teller', async () => {
    const miss = await ola.rpc('lookup_ean', { p_ean: EAN });
    assert.deepEqual(miss.data, []);
    const s = await ola.rpc('suggest_ean', { p_ean: EAN, p_product: productA });
    assert.equal(s.data, 'mapped');
    const hit = await kari.rpc('lookup_ean', { p_ean: EAN });
    assert.equal(hit.data[0].vmp_nr, '1670901');
  });

  it('forslag om annet produkt blir konflikt som admin ser og løser', async () => {
    const { data: pid } = await kari.rpc('ensure_product', { p_vmp_nr: '1616601', p_name: 'Paolo Scavino Barolo Cannubi 2019', p_type: 'Rødvin', p_vintage: 2019, p_price: 989 });
    productB = pid;
    const s = await kari.rpc('suggest_ean', { p_ean: EAN, p_product: productB });
    assert.equal(s.data, 'conflict');
    const { data: rows } = await admin.from('admin_eans').select('*').eq('ean', EAN);
    assert.equal(rows.length, 2);
    assert.ok(rows.every((r) => r.conflict));
    assert.equal(rows.find((r) => r.mapped).vmp_nr, '1670901');
    assert.equal(rows.find((r) => r.mapped).hits, 1);
    // Vanlig bruker ser ikke admin-visningen
    const { data: none } = await ola.from('admin_eans').select('*').eq('ean', EAN);
    assert.deepEqual(none, []);
    // «Behold denne» for produkt B
    await admin.from('ean_map').update({ product_id: productB }).eq('ean', EAN);
    await admin.from('ean_suggestions').delete().eq('ean', EAN).neq('product_id', productB);
    const { data: solved } = await admin.from('admin_eans').select('*').eq('ean', EAN);
    assert.equal(solved.length, 1);
    assert.equal(solved[0].conflict, false);
  });
});

describe('vinmonopolet-proxy', () => {
  it('krever innlogget bruker', async () => {
    const r = await fetch(`${URL}/functions/v1/vmp/products/v0/details-normal?maxResults=1`, { headers: { apikey: ANON, Authorization: 'Bearer ' + ANON } });
    assert.equal(r.status, 401);
  });

  it('søker via proxyen og logger api_health', async () => {
    const { data: { session } } = await ola.auth.getSession();
    const r = await fetch(`${URL}/functions/v1/vmp/products/v0/details-normal?productShortNameContains=barolo_cannubi&maxResults=20`, {
      headers: { apikey: ANON, Authorization: 'Bearer ' + session.access_token },
    });
    assert.equal(r.status, 200);
    const rows = await r.json();
    assert.equal(rows.length, 2);
    const blocked = await fetch(`${URL}/functions/v1/vmp/prices/v0/x`, { headers: { apikey: ANON, Authorization: 'Bearer ' + session.access_token } });
    assert.equal(blocked.status, 403);
    const { data: health } = await admin.from('api_health').select('*').order('at', { ascending: false }).limit(1);
    assert.equal(health[0].status, 200);
    assert.equal(health[0].source, 'proxy');
  });

  it('vmp-sync: «Oppdater fra API» for ett produkt, og nattlig synk med service-nøkkel', async () => {
    await service.from('products').update({ name: 'Gammelt navn' }).eq('id', productA);
    const one = await invoke(ola, 'vmp-sync', { vmp_nr: '1670901' });
    assert.equal(one.error, null);
    const { data: p } = await ola.from('products').select('name,vmp_updated_at').eq('id', productA).single();
    assert.equal(p.name, 'Brezza Barolo Cannubi 2017');
    assert.ok(p.vmp_updated_at);
    const denied = await invoke(ola, 'vmp-sync', {});
    assert.equal(denied.status, 403);
    const cron = await invoke(service, 'vmp-sync', {});
    assert.equal(cron.error, null);
    assert.ok(cron.data.seen >= 9);
  });
});

describe('produktdata fra vinmonopolet.no', () => {
  it('preview gir data uten å lagre, og vanlig kall fyller inn produktet', async () => {
    const { data: pid } = await ola.rpc('ensure_product', { p_vmp_nr: '9422102', p_name: 'Charles Smith Kung Fu Girl Riesling 2020', p_type: 'Rødvin' });
    const prev = await invoke(ola, 'vmp-sync', { vmp_nr: '9422102', preview: true });
    assert.equal(prev.error, null);
    assert.equal(prev.data.details.type, 'Hvitvin');
    const { data: before } = await ola.from('products').select('type,taste').eq('id', pid).single();
    assert.deepEqual(before, { type: 'Rødvin', taste: null }, 'preview skal ikke lagre');

    const r = await invoke(ola, 'vmp-sync', { vmp_nr: '9422102' });
    assert.equal(r.error, null);
    assert.equal(r.data.details, true);
    const { data: p } = await ola.from('products').select('type,vintage,price,country,region,grapes,abv,taste,food,volume_cl').eq('id', pid).single();
    assert.deepEqual(p, {
      type: 'Hvitvin', vintage: 2020, price: 49.5, country: 'USA', region: 'Washington, Columbia Valley',
      grapes: ['Riesling 98%', 'Sauvignon Blanc 2%'], abv: 12,
      taste: 'Ørlite utviklet, preg av sitrus, eple og litt krydder, hint av mineraler i ettersmak.', food: 'Skalldyr · Fisk · Ost', volume_cl: 37.5,
    });
    const { data: h } = await admin.from('api_health').select('status,source').eq('source', 'web').order('at', { ascending: false }).limit(1);
    assert.deepEqual(h[0], { status: 200, source: 'web' });
  });

  it('ukjent varenummer på nettstedet ødelegger ingenting', async () => {
    const r = await invoke(ola, 'vmp-sync', { vmp_nr: '99999999', preview: true });
    assert.equal(r.error, null);
    assert.equal(r.data.details, null);
  });
});

describe('admin', () => {
  it('admin leser alt: skap, beholdning, historikk, statistikk', async () => {
    const { data: cellars } = await admin.from('admin_cellars').select('*').eq('id', olaCellar).single();
    assert.equal(cellars.bottles, 4);
    assert.equal(cellars.members, 3); // ola, kari og lise
    assert.equal(Number(cellars.value), 4 * 689);
    const { data: mv } = await admin.from('movements').select('id').eq('cellar_id', olaCellar);
    assert.equal(mv.length, 9); // inkl. lises ut + inn, den manuelle vinen og bildevinen inn + ut
    const { data: days } = await admin.rpc('admin_scans_per_day', { p_days: 14 });
    assert.equal(days.length, 14);
    assert.ok(days.at(-1).n >= 2);
    const { data: act } = await admin.from('admin_activity').select('*').order('created_at', { ascending: false }).limit(50);
    assert.ok(act.some((a) => a.kind === 'inn'));
    assert.ok(act.some((a) => a.kind === 'ean'));
    assert.ok(act.some((a) => a.kind === 'admin'));
    const denied = await ola.rpc('admin_scans_per_day', { p_days: 14 });
    assert.ok(denied.error);
  });

  it('duplikater: vises, «Ikke duplikat» huskes, «Slå sammen» flytter beholdning', async () => {
    const { data: manual } = await admin.from('products').insert({ name: 'Brezza Barolo Cannubi 2017 (manuell)', type: 'Rødvin' }).select('id').single();
    await service.from('cellar_items').insert({ cellar_id: olaCellar, product_id: manual.id, qty: 1 });
    const { data: d } = await admin.from('admin_duplicates').select('*').eq('merge_id', manual.id);
    assert.equal(d.length, 1);
    assert.equal(d[0].keep_id, productA);
    assert.equal(d[0].merge_bottles, 1);

    await admin.from('dupe_ignores').insert({ keep_id: productA, merge_id: manual.id });
    const { data: ignored } = await admin.from('admin_duplicates').select('*').eq('merge_id', manual.id);
    assert.equal(ignored.length, 0);
    await admin.from('dupe_ignores').delete().eq('merge_id', manual.id);

    assert.ifError((await admin.rpc('admin_merge_products', { p_keep: productA, p_merge: manual.id })).error);
    const { data: item } = await ola.from('cellar_items').select('qty').eq('cellar_id', olaCellar).eq('product_id', productA).single();
    assert.equal(item.qty, 5);
    const denied = await ola.rpc('admin_merge_products', { p_keep: productA, p_merge: productB });
    assert.ok(denied.error);
  });

  it('deaktivert bruker kan ikke skrive og ikke logge inn; aktiver igjen virker', async () => {
    const { data: users } = await admin.rpc('admin_users');
    const k = users.find((u) => u.email === mail('kari'));
    assert.equal((await invoke(admin, 'admin-users', { id: k.id, email: mail('kari'), action: 'deactivate' })).error, null);
    const w = await kari.rpc('register_movement', { p_cellar: olaCellar, p_product: productA, p_dir: 'in', p_qty: 1, p_client_id: 'kd-' + run });
    assert.ok(w.error, 'deaktivert bruker skal ikke kunne skrive');
    const s = await kari.rpc('suggest_ean', { p_ean: '7000000000017', p_product: productA });
    assert.ok(s.error);
    const { error } = await anonClient().auth.signInWithPassword({ email: mail('kari'), password: PW });
    assert.ok(error, 'utestengt bruker skal ikke kunne logge inn');
    const { data: after } = await admin.rpc('admin_users');
    assert.equal(after.find((u) => u.email === mail('kari')).status, 'deaktivert');

    assert.equal((await invoke(admin, 'admin-users', { id: k.id, email: mail('kari'), action: 'reactivate' })).error, null);
    kari = await signedIn(mail('kari'));
    const ok = await kari.rpc('register_movement', { p_cellar: olaCellar, p_product: productA, p_dir: 'in', p_qty: 1, p_client_id: 'kr-' + run });
    assert.ifError(ok.error);
  });
});
