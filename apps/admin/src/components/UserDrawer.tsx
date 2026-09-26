import { useQueryClient } from '@tanstack/react-query';
import { relTime, shortDate } from '@vinskap/shared';
import { useAdmin } from '../App';
import { useActivity, useCellars, useMembers, useUsers } from '../data';
import { adminAction } from '../supabase';
import { StatusPill } from './common';

export function UserDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { narrow, flash, go, openCellar, me } = useAdmin();
  const qc = useQueryClient();
  const u = useUsers().data?.find((x) => x.id === id);
  const cellars = useCellars().data ?? [];
  const members = useMembers().data ?? [];
  const acts = (useActivity().data ?? []).filter((a) => a.actor === id || (u && a.what.includes(u.email))).slice(0, 5);
  if (!u) return null;

  const act = async (action: string, ok: string) => {
    const err = await adminAction({ id: u.id, email: u.email, action });
    flash(err ?? ok);
    ['users', 'activity'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    if (!err && action === 'revoke') onClose();
  };

  const mine = members.filter((m) => m.user_id === u.id);
  const isMe = u.id === me.id;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(42,37,32,0.3)', zIndex: 49 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: narrow ? '100%' : 440, background: 'var(--ivory)', borderLeft: '1px solid var(--sage-light)', zIndex: 50, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--sage-light)' }}>
          <div className="label">Bruker</div>
          <button className="link-btn" onClick={onClose}>Lukk</button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="syne" style={{ fontWeight: 800, fontSize: 28, lineHeight: 1.05, letterSpacing: '-0.03em' }}>{u.name || '—'}</div>
            <div className="muted" style={{ fontSize: 14 }}>{u.email}</div>
            <div><StatusPill s={u.status} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', borderTop: '1px solid var(--sage-light)', borderBottom: '1px solid var(--sage-light)' }}>
            <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 2 }}><div className="label-sm">Flasker</div><div className="syne" style={{ fontWeight: 700, fontSize: 20 }}>{u.bottles}</div></div>
            <div style={{ padding: 12, borderLeft: '1px solid var(--sage-light)', display: 'flex', flexDirection: 'column', gap: 2 }}><div className="label-sm">Skann</div><div className="syne" style={{ fontWeight: 700, fontSize: 20 }}>{u.scans}</div></div>
            <div style={{ padding: 12, borderLeft: '1px solid var(--sage-light)', display: 'flex', flexDirection: 'column', gap: 2 }}><div className="label-sm">Opprettet</div><div style={{ fontSize: 14, fontWeight: 600, paddingTop: 4 }}>{shortDate(u.created_at)}</div></div>
          </div>
          {mine.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="section">Skap</div>
              {mine.map((m) => {
                const c = cellars.find((x) => x.id === m.cellar_id);
                return (
                  <button key={m.cellar_id} onClick={() => { go('cellars'); openCellar(m.cellar_id); }}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', border: 0, borderBottom: '1px solid var(--ivory-dark)', background: 'transparent', color: 'var(--coal)', textAlign: 'left' }}>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{c?.name ?? '—'}</span>
                      <span className="muted" style={{ fontSize: 13 }}>{m.role === 'owner' ? 'Eier' : 'Medlem'} · {c?.bottles ?? 0} fl.</span>
                    </span>
                    <span style={{ color: 'var(--sage-dark)' }}>→</span>
                  </button>
                );
              })}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="section">Siste aktivitet</div>
            {acts.map((a, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 0', borderBottom: '1px solid var(--ivory-dark)' }}>
                <span className="muted" style={{ fontSize: 12 }}>{relTime(a.created_at, 'admin')}</span><span style={{ fontSize: 14 }}>{a.what}</span>
              </div>
            ))}
            {!acts.length && <div className="muted" style={{ fontSize: 14, padding: '10px 0' }}>Ingen aktivitet.</div>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="section">Handlinger</div>
            {u.status === 'invitert' && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn" onClick={() => act('resend', 'Invitasjon sendt på nytt til ' + u.email)}>Send invitasjon på nytt</button>
                <button className="btn danger" onClick={() => act('revoke', 'Invitasjon trukket tilbake')}>Trekk tilbake</button>
              </div>
            )}
            {u.status === 'aktiv' && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn" onClick={async () => { const err = await adminAction({ email: u.email, action: 'reset' }); flash(err ?? 'Kode for nytt passord sendt til ' + u.email); qc.invalidateQueries({ queryKey: ['activity'] }); }}>Nullstill passord</button>
                {!isMe && <button className="btn danger" onClick={() => act('deactivate', 'Deaktiverte ' + u.email)}>Deaktiver</button>}
              </div>
            )}
            {u.status === 'deaktivert' && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn primary" onClick={() => act('reactivate', 'Aktiverte ' + u.email)}>Aktiver igjen</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
