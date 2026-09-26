// POST – kun admin.
//   { email, name }                     inviter (Supabase-invitasjon med kode)
//   { email, action: 'reset' }          e-post med kode for nytt passord
//   { id, email, action: 'resend' }     send invitasjonen på nytt
//   { id, email, action: 'revoke' }     trekk tilbake en ubesvart invitasjon (sletter brukeren)
//   { id, email, action: 'deactivate' } status = deaktivert + utestengt fra innlogging
//   { id, email, action: 'reactivate' } status = aktiv + utestenging opphevet
// Deploy: supabase functions deploy admin-invite
import { createClient } from 'npm:@supabase/supabase-js@2';
import { CORS, json } from '../_shared/cors.ts';

const BAN_FOREVER = '876000h'; // 100 år

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const url = Deno.env.get('SUPABASE_URL')!;
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: isAdmin } = await caller.rpc('is_admin');
  if (!isAdmin) return new Response('Forbidden', { status: 403, headers: CORS });

  const body = await req.json().catch(() => ({}));
  const action: string = body.action ?? 'invite';
  const email = String(body.email ?? '').trim().toLowerCase();
  const id: string | undefined = body.id;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: me } = await caller.auth.getUser();
  const actor = me.user?.id;
  const log = (what: string) => admin.from('audit_log').insert({ actor, kind: 'admin', action: what, target: email });
  const fail = (msg: string, status = 400) => json({ ok: false, error: msg }, status);

  if (!/^\S+@\S+\.\S+$/.test(email)) return fail('Ugyldig e-post');

  switch (action) {
    case 'invite': {
      const name = String(body.name ?? '').trim();
      if (!name) return fail('Navn mangler');
      const { error } = await admin.auth.admin.inviteUserByEmail(email, { data: { name } });
      if (error) return fail(error.message);
      await admin.from('service_invites').upsert({ email, name, invited_by: actor });
      await log('Inviterte');
      return json({ ok: true });
    }
    case 'reset': {
      const { error } = await admin.auth.resetPasswordForEmail(email);
      if (error) return fail(error.message);
      await log('Nullstilte passord for');
      return json({ ok: true });
    }
  }

  // Resten gjelder en bestemt bruker. Sjekk at id og e-post hører sammen.
  if (!id) return fail('id mangler');
  const { data: target, error: getErr } = await admin.auth.admin.getUserById(id);
  if (getErr || !target.user || target.user.email?.toLowerCase() !== email) return fail('Fant ikke brukeren', 404);
  const confirmed = !!target.user.email_confirmed_at;

  switch (action) {
    case 'resend': {
      if (confirmed) return fail('Brukeren har allerede aktivert kontoen');
      const { error } = await admin.auth.admin.inviteUserByEmail(email, { data: target.user.user_metadata });
      if (error) return fail(error.message);
      await log('Sendte invitasjon på nytt til');
      return json({ ok: true });
    }
    case 'revoke': {
      if (confirmed) return fail('Brukeren har allerede aktivert kontoen');
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) return fail(error.message);
      await admin.from('service_invites').delete().eq('email', email);
      await log('Trakk tilbake invitasjon til');
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
