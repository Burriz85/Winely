import { useQueryClient } from '@tanstack/react-query';
import { kr, relTime } from '@vinskap/shared';
import { useState } from 'react';
import { useAdmin } from '../App';
import { PageHead, Thumb } from '../components/common';
import { useCellarItems, useCellars, useMembers, useNameOf, useUsers } from '../data';
import { supabase } from '../supabase';

export function Cellars() {
  const { selCellar, openCellar, openUser, flash } = useAdmin();
  const qc = useQueryClient();
  const users = useUsers().data ?? [];
  const [addUser, setAddUser] = useState('');
  const setMember = async (cellarId: string, userId: string, add: boolean) => {
    const { error } = await supabase.rpc('admin_set_member', { p_cellar: cellarId, p_user: userId, p_add: add });
    if (error) return flash(error.message);
    setAddUser('');
    flash(add ? 'Lagt til i skapet' : 'Fjernet fra skapet');
    ['members', 'cellars', 'users', 'activity'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };
  const cellars = useCellars().data ?? [];
  const members = useMembers().data ?? [];
  const items = useCellarItems(selCellar);
  const nameOf = useNameOf();
  const sc = cellars.find((c) => c.id === selCellar);

  return (
    <div className="page">
      <PageHead label="Alle skap · innholdet kan bare leses" title="Skap" />
      <div className="rows">
        {cellars.map((c) => (
          <div key={c.id} className="clickable" onClick={() => openCellar(c.id)} style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: '8px 16px', alignItems: 'center', padding: '14px 12px', margin: '0 -12px',
            borderBottom: '1px solid var(--ivory-dark)', borderRadius: 4, background: selCellar === c.id ? 'var(--sage-tint)' : undefined,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div className="syne" style={{ fontWeight: 600, fontSize: 16 }}>{c.name}</div>
              <div className="muted" style={{ fontSize: 13 }}>Eier: {nameOf(c.owner_id)}</div>
            </div>
            <div className="muted" style={{ fontSize: 13 }}>{c.members} medlem(mer)</div>
            <div className="muted" style={{ fontSize: 13 }}>{c.bottles} fl. · {c.wines} viner</div>
            <div style={{ fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{kr(Number(c.value))}</div>
          </div>
        ))}
        {!cellars.length && <div className="empty">Ingen skap ennå.</div>}
      </div>
      {sc && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: 20, background: 'var(--ivory-dark)', borderRadius: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div className="syne" style={{ fontWeight: 800, fontSize: 26, textTransform: 'uppercase', letterSpacing: '-0.03em' }}>{sc.name}</div>
              <div className="muted" style={{ fontSize: 13 }}>{sc.bottles} flasker · {kr(Number(sc.value))} · oppdatert {relTime(sc.updated_at, 'admin')}</div>
            </div>
            <button className="link-btn" onClick={() => openCellar(null)}>Lukk</button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {members.filter((m) => m.cellar_id === sc.id).map((m) => (
              <span key={m.user_id} style={{ display: 'inline-flex', alignItems: 'center', height: 32, border: '1px solid var(--sage-light)', borderRadius: 16, background: 'var(--ivory)', fontSize: 13 }}>
                <button onClick={() => openUser(m.user_id)} style={{ height: 30, padding: '0 10px 0 12px', border: 0, background: 'transparent', fontSize: 13, color: 'var(--coal)' }}>
                  {nameOf(m.user_id)} · {m.role === 'owner' ? 'Eier' : 'Medlem'}
                </button>
                {m.role !== 'owner' && (
                  <button aria-label="Fjern fra skapet" title="Fjern fra skapet" onClick={() => setMember(sc.id, m.user_id, false)}
                    style={{ height: 30, width: 28, border: 0, borderLeft: '1px solid var(--sage-light)', background: 'transparent', color: 'var(--red)', fontSize: 15 }}>×</button>
                )}
              </span>
            ))}
            <span style={{ display: 'inline-flex', gap: 6 }}>
              <select className="field" value={addUser} onChange={(e) => setAddUser(e.target.value)} style={{ height: 32, width: 'auto', fontSize: 13, padding: '0 8px' }}>
                <option value="">Legg til bruker …</option>
                {users.filter((u) => !members.some((m) => m.cellar_id === sc.id && m.user_id === u.id)).map((u) => (
                  <option key={u.id} value={u.id}>{u.name || u.email}</option>
                ))}
              </select>
              {addUser && <button className="btn primary" style={{ height: 32 }} onClick={() => setMember(sc.id, addUser, true)}>Legg til</button>}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--ivory)', borderRadius: 4, padding: '0 14px' }}>
            {(items.data ?? []).map((i) => (
              <div key={i.nr + i.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--ivory-dark)' }}>
                <Thumb nr={i.nr} img={i.img} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{i.name}</span>
                  <span className="muted" style={{ fontSize: 12 }}>Varenr. {i.nr || '—'}</span>
                </div>
                <div className="syne" style={{ fontWeight: 700, fontSize: 18 }}>×{i.qty}</div>
              </div>
            ))}
            {items.isSuccess && !items.data.length && <div className="empty" style={{ padding: '14px 0' }}>Skapet er tomt.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
