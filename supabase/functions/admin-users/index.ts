// POST – kun admin. Brukere opprettes av admin med passord; det sendes ingen e-post.
//   { email, name, password, action: 'create', cellar_id? }   ny bruker (email kan være <brukernavn>@vinskap.local);
//                                                 med cellar_id blir brukeren medlem av det skapet i stedet for å få eget
//   { id, email, password, action: 'set_password' } nytt passord
//   { id, email, action: 'deactivate' }            status = deaktivert + utestengt fra innlogging
//   { id, email, action: 'reactivate' }            status = aktiv + utestenging opphevet
// Deploy: supabase functions deploy admin-users
import { createClient } from 'npm:@supabase/supabase-js@2';
import { CORS, json } from '../_shared/cors.ts';

const BAN_FOREVER = '876000h'; // 100 år
const MIN_PW = 8;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const url = Deno.env.get('SUPABASE_URL')!;
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: isAdmin } = await caller.rpc('is_admin');
  if (!isAdmin) return new Response('Forbidden', { status: 403, headers: CORS });

  const body = await req.json().catch(() => ({}));
  const action: string = body.action ?? '';
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const id: string | undefined = body.id;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: me } = await caller.auth.getUser();
  const actor = me.user?.id;
  const log = (what: string) => admin.from('audit_log').insert({ actor, kind: 'admin', action: what, target: email });
  const fail = (msg: string, status = 400) => json({ ok: false, error: msg }, status);

  if (!/^\S+@\S+\.\S+$/.test(email)) return fail('Ugyldig brukernavn eller e-post');

  if (action === 'create') {
    const name = String(body.name ?? '').trim();
    if (!name) return fail('Navn mangler');
    if (password.length < MIN_PW) return fail(`Passordet må ha minst ${MIN_PW} tegn`);
    // join_cellar: bli medlem av et eksisterende skap i stedet for å få eget (handle_new_user).
    const join = typeof body.cellar_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.cellar_id) ? body.cellar_id : undefined;
    const { error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: join ? { name, join_cellar: join } : { name },
    });
    if (error) return fail(/already/i.test(error.message) ? 'Brukeren finnes allerede' : error.message);
    await log('Opprettet bruker');
    return json({ ok: true });
  }

  // Resten gjelder en bestemt bruker. Sjekk at id og e-post hører sammen.
  if (!id) return fail('id mangler');
  const { data: target, error: getErr } = await admin.auth.admin.getUserById(id);
  if (getErr || !target.user || target.user.email?.toLowerCase() !== email) return fail('Fant ikke brukeren', 404);

  switch (action) {
    case 'set_password': {
      if (password.length < MIN_PW) return fail(`Passordet må ha minst ${MIN_PW} tegn`);
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      if (error) return fail(error.message);
      await log('Satte nytt passord for');
      return json({ ok: true });
    }
    case 'deactivate':
    case 'reactivate': {
      if (id === actor) return fail('Du kan ikke deaktivere deg selv');
      const on = action === 'reactivate';
      // Utestengingen stopper innlogging og fornying av økten. Aktive tilgangstokener
      // lever til de går ut (jwt_expiry), men is_member() stopper skriving med én gang.
      const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: on ? 'none' : BAN_FOREVER });
      if (error) return fail(error.message);
      await admin.from('profiles').update({ status: on ? 'aktiv' : 'deaktivert' }).eq('id', id);
      await log(on ? 'Aktiverte' : 'Deaktiverte');
      return json({ ok: true });
    }
  }
  return fail('Ukjent handling');
});
