import { useQueryClient } from '@tanstack/react-query';
import { displayLogin, toLoginEmail } from '@vinskap/shared';
import { useState } from 'react';
import { useAdmin } from '../App';
import { useCellars, useNameOf } from '../data';
import { adminAction } from '../supabase';

/** 12 tegn uten tegn som er lette å forveksle (0/O, 1/l/I). */
export function makePassword() {
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const r = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(r, (n) => abc[n % abc.length]).join('');
}

export function NewUserModal({ onClose }: { onClose: () => void }) {
  const { flash } = useAdmin();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [login, setLogin] = useState('');
  const [pw, setPw] = useState(makePassword);
  const [cellar, setCellar] = useState('');
  const cellars = useCellars().data ?? [];
  const nameOf = useNameOf();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ login: string; pw: string } | null>(null);

  const send = async () => {
    const email = toLoginEmail(login);
    if (!name.trim() || !email) return flash('Fyll inn navn og et gyldig brukernavn eller e-post');
    if (pw.length < 8) return flash('Passordet må ha minst 8 tegn');
    setBusy(true);
    const err = await adminAction({ action: 'create', email, name: name.trim(), password: pw, ...(cellar ? { cellar_id: cellar } : {}) });
    setBusy(false);
    if (err) return flash(err);
    ['users', 'activity', 'cellars', 'members'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    setDone({ login: displayLogin(email), pw });
  };

  const label = (t: string) => <span className="label">{t}</span>;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(42,37,32,0.4)', zIndex: 55, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 420, background: 'var(--ivory)', borderRadius: 4, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="syne" style={{ fontWeight: 700, fontSize: 22, textTransform: 'uppercase' }}>Ny bruker</div>
        {done ? (
          <>
            <div className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>Gi dette til brukeren. Passordet vises bare nå. Brukeren kan bytte det under Profil i appen.</div>
            <div style={{ padding: 14, background: 'var(--ivory-dark)', borderRadius: 4, fontSize: 15, lineHeight: 1.8, fontFamily: 'ui-monospace,monospace' }}>
              Brukernavn: {done.login}<br />Passord: {done.pw}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => navigator.clipboard?.writeText(`Brukernavn: ${done.login}\nPassord: ${done.pw}`).then(() => flash('Kopiert'))}>Kopier</button>
              <button className="btn primary" onClick={onClose}>Ferdig</button>
            </div>
          </>
        ) : (
          <>
            <div className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>Registrering er stengt. Brukeren logger inn med brukernavnet og passordet du lager her. Det sendes ingen e-post.</div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{label('Navn')}
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{label('Brukernavn eller e-post')}
              <input className="field" value={login} onChange={(e) => setLogin(e.target.value)} autoCapitalize="none" spellCheck={false} /></label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{label('Passord')}
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="field" value={pw} onChange={(e) => setPw(e.target.value)} style={{ fontFamily: 'ui-monospace,monospace' }} />
                <button className="btn" type="button" onClick={() => setPw(makePassword())}>Nytt</button>
              </div></label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{label('Skap')}
              <select className="field" value={cellar} onChange={(e) => setCellar(e.target.value)}>
                <option value="">Eget, nytt skap</option>
                {cellars.map((c) => <option key={c.id} value={c.id}>Del «{c.name}» med {nameOf(c.owner_id)}</option>)}
              </select>
              {cellar && <span className="muted" style={{ fontSize: 12 }}>Brukeren ser og registrerer i dette skapet og får ikke eget skap.</span>}
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={onClose}>Avbryt</button>
              <button className="btn primary" onClick={send} disabled={busy}>{busy ? 'Oppretter …' : 'Opprett bruker'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
