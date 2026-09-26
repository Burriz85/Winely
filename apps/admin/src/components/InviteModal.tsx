import { useQueryClient } from '@tanstack/react-query';
import { isEmail } from '@vinskap/shared';
import { useState } from 'react';
import { useAdmin } from '../App';
import { useUsers } from '../data';
import { adminAction } from '../supabase';

export function InviteModal({ onClose }: { onClose: () => void }) {
  const { flash } = useAdmin();
  const qc = useQueryClient();
  const users = useUsers().data ?? [];
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const e = email.trim().toLowerCase();
    if (!isEmail(e) || !name.trim()) return flash('Fyll inn navn og gyldig e-post');
    if (users.some((u) => u.email.toLowerCase() === e)) return flash('Brukeren finnes allerede');
    setBusy(true);
    const err = await adminAction({ email: e, name: name.trim() });
    setBusy(false);
    if (err) return flash(err);
    ['users', 'activity'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    flash('Invitasjon sendt til ' + e);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(42,37,32,0.4)', zIndex: 55, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 420, background: 'var(--ivory)', borderRadius: 4, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="syne" style={{ fontWeight: 700, fontSize: 22, textTransform: 'uppercase' }}>Inviter bruker</div>
        <div className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>Brukeren får en e-post med en kode for å lage passord i appen. Registrering er ellers stengt.</div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="label">Navn</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="label">E-post</span>
          <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        </label>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>Avbryt</button>
          <button className="btn primary" onClick={send} disabled={busy}>{busy ? 'Sender …' : 'Send invitasjon'}</button>
        </div>
      </div>
    </div>
  );
}
