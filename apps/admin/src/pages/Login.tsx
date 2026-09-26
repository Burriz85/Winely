import { useState } from 'react';
import { supabase } from '../supabase';

/** Ikke i prototypen: admin trenger egen innlogging. Samme uttrykk som appens innlogging. */
export function Login({ denied, email: deniedEmail }: { denied?: boolean; email?: string }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: pw });
    setBusy(false);
    if (error) setErr(error.message.toLowerCase().includes('invalid') ? 'Feil e-post eller passord.' : error.message.toLowerCase().includes('banned') ? 'Kontoen er deaktivert.' : error.message);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', padding: '72px 24px 40px' }}>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <img src="/monogram-bg-sage.png" alt="B & G" style={{ width: 96, height: 96, objectFit: 'contain', alignSelf: 'center', marginBottom: 8 }} />
          <div className="label">Vinskap · Admin</div>
          <div className="hero">Logg inn</div>
        </div>
        {denied ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="err">{deniedEmail} har ikke admin-tilgang.</div>
            <button className="btn" style={{ height: 52, fontSize: 15 }} onClick={() => supabase.auth.signOut()}>Logg ut</button>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="label">E-post</span>
              <input className="field" style={{ height: 48, fontSize: 16 }} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="label">Passord</span>
              <input className="field" style={{ height: 48, fontSize: 16 }} type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </label>
            {err && <div className="err">{err}</div>}
            <button className="btn primary" style={{ height: 56, fontSize: 16 }} disabled={busy}>{busy ? 'Vent …' : 'Logg inn'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
