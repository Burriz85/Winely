import { displayLogin, relTime } from '@vinskap/shared';
import { useState } from 'react';
import { useAdmin } from '../App';
import { Chips, PageHead, SearchBox, StatusPill } from '../components/common';
import { useCellars, useUsers } from '../data';

export function Users() {
  const { narrow, openUser, openInvite, userFilter, setUserFilter } = useAdmin();
  const users = useUsers();
  const cellars = useCellars().data ?? [];
  const [q, setQ] = useState('');
  const cols = narrow ? 'minmax(0,1fr) auto' : 'minmax(0,2fr) minmax(0,1.5fr) minmax(0,1.5fr) auto';
  const rows = (users.data ?? []).filter((u) =>
    (userFilter === 'Alle' || u.status === userFilter.toLowerCase()) &&
    (!q || (u.name + ' ' + u.email).toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="page">
      <PageHead label="Opprettes av admin" title="Brukere" right={<button className="btn primary" onClick={openInvite}>+ Ny bruker</button>} />
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 220 }}><SearchBox value={q} onChange={setQ} placeholder="Søk på navn eller brukernavn" /></div>
        <Chips options={['Alle', 'Aktiv', 'Deaktivert']} value={userFilter} onChange={setUserFilter} />
      </div>
      <div className="rows">
        {rows.map((u) => (
          <div key={u.id} className="row clickable" onClick={() => openUser(u.id)}
            style={{ display: 'grid', gridTemplateColumns: cols, gap: '6px 16px', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <div className="syne" style={{ fontWeight: 600, fontSize: 16 }}>{u.name || '—'}{u.is_admin && <span className="muted" style={{ fontFamily: 'Figtree', fontWeight: 500, fontSize: 12 }}> · admin</span>}</div>
              <div className="muted" style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayLogin(u.email)}</div>
            </div>
            {!narrow && <div className="muted" style={{ fontSize: 13 }}>Skap: {u.cellar_ids.map((c) => cellars.find((x) => x.id === c)?.name).filter(Boolean).join(', ') || '—'} · {u.bottles} fl.</div>}
            {!narrow && <div className="muted" style={{ fontSize: 13 }}>Sist aktiv: {relTime(u.last_active, 'admin')}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><StatusPill s={u.status} /></div>
          </div>
        ))}
        {users.isSuccess && !rows.length && <div className="empty">Ingen brukere matcher.</div>}
        {users.error && <div className="err" style={{ padding: '12px 0' }}>{(users.error as Error).message}</div>}
      </div>
    </div>
  );
}
