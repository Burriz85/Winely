import { relTime } from '@vinskap/shared';
import { useState } from 'react';
import { Chips, PageHead } from '../components/common';
import { useActivity, useNameOf } from '../data';

const TAG = { inn: ['Inn', '#4E6B4D', '#E4ECE3'], ut: ['Ut', '#A04040', '#F3E2E0'], ean: ['Strekkode', '#A87C28', '#F4EBD6'], admin: ['Admin', '#2A2520', '#F0EFE8'], auth: ['Innlogging', '#2A2520', '#F0EFE8'] } as const;
const FILTER: Record<string, string | null> = { Alle: null, Inn: 'inn', Ut: 'ut', Strekkode: 'ean', Admin: 'admin' };

export function Activity() {
  const [f, setF] = useState('Alle');
  const act = useActivity();
  const nameOf = useNameOf();
  const rows = (act.data ?? []).filter((a) => !FILTER[f] || a.kind === FILTER[f]);
  return (
    <div className="page">
      <PageHead label="Alle hendelser" title="Aktivitet" />
      <Chips options={Object.keys(FILTER)} value={f} onChange={setF} />
      <div className="rows">
        {rows.map((a, i) => {
          const [tag, color, bg] = TAG[a.kind] ?? TAG.admin;
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '100px 96px minmax(0,1fr)', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--ivory-dark)', fontSize: 14 }}>
              <div className="muted" style={{ fontSize: 13 }}>{relTime(a.created_at, 'admin')}</div>
              <div><span style={{ display: 'inline-flex', height: 22, alignItems: 'center', padding: '0 8px', borderRadius: 11, fontSize: 11, fontWeight: 600, color, background: bg }}>{tag}</span></div>
              <div><span style={{ fontWeight: 600 }}>{nameOf(a.actor)}</span> · {a.what}</div>
            </div>
          );
        })}
        {act.isSuccess && !rows.length && <div className="empty">Ingen hendelser.</div>}
      </div>
    </div>
  );
}
