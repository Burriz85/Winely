import { kr, relTime } from '@vinskap/shared';
import { useAdmin } from '../App';
import { useActivity, useApiHealth, useCellars, useDupes, useEans, useNameOf, useScansPerDay, useUsers } from '../data';

export function Overview() {
  const { go } = useAdmin();
  const users = useUsers().data ?? [];
  const cellars = useCellars().data ?? [];
  const eans = useEans().data ?? [];
  const dupes = useDupes().data ?? [];
  const days = useScansPerDay().data ?? [];
  const act = useActivity(5).data ?? [];
  const api = useApiHealth().data;
  const nameOf = useNameOf();

  const invited = users.filter((u) => u.status === 'invitert').length;
  const conflicts = new Set(eans.filter((e) => e.conflict).map((e) => e.ean)).size;
  const max = Math.max(1, ...days.map((d) => d.n));
  const first = days[0] ? new Date(days[0].day) : null;
  const todo = [
    conflicts ? { label: conflicts + ' strekkoder med konflikt', go: () => go('eans') } : null,
    dupes.length ? { label: dupes.length + ' mulige duplikater', go: () => go('dupes') } : null,
    invited ? { label: invited + ' ubesvarte invitasjoner', go: () => go('users', { userFilter: 'Invitert' }) } : null,
  ].filter(Boolean) as { label: string; go: () => void }[];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div className="page-head">
        <div className="label">Tjenesten · i dag</div>
        <div className="hero">Oversikt</div>
      </div>
      <div className="stats">
        <div><div className="label-sm">Aktive brukere</div><div className="stat-val">{users.filter((u) => u.status === 'aktiv').length}</div><div style={{ fontSize: 12, color: 'var(--honey-text)', fontWeight: 500 }}>+{invited} invitert</div></div>
        <div><div className="label-sm">Skap</div><div className="stat-val">{cellars.length}</div></div>
        <div><div className="label-sm">Flasker</div><div className="stat-val">{cellars.reduce((a, c) => a + Number(c.bottles), 0)}</div><div style={{ fontSize: 12 }} className="muted">{kr(cellars.reduce((a, c) => a + Number(c.value), 0))}</div></div>
        <div><div className="label-sm">Skann · 14 dager</div><div className="stat-val">{days.reduce((a, d) => a + Number(d.n), 0)}</div></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 28 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="section">Skann per dag</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 140 }}>
            {days.map((d, i) => (
              <div key={d.day} title={`${d.day}: ${d.n}`} style={{ flex: 1, height: Math.round((Number(d.n) / max) * 100) + '%', background: i === days.length - 1 ? 'var(--honey-text)' : 'var(--sage-light)', borderRadius: '2px 2px 0 0', minHeight: 4 }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }} className="muted">
            <span>{first ? relTime(first, 'admin') : ''}</span><span>I dag</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="section">Trenger oppfølging</div>
          {todo.map((t) => (
            <button key={t.label} onClick={t.go} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 48, padding: '0 14px', border: '1px solid var(--sage-light)', borderRadius: 4, background: '#FFFFFF', color: 'var(--coal)', fontSize: 14, fontWeight: 500, textAlign: 'left' }}>
              <span>{t.label}</span><span style={{ color: 'var(--sage-dark)' }}>→</span>
            </button>
          ))}
          {!todo.length && <div className="muted" style={{ fontSize: 14, padding: '6px 0' }}>Ingenting venter.</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--ivory-dark)', borderRadius: 4, fontSize: 14 }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: api?.latest && api.latest.status < 400 ? 'var(--sage-dark)' : 'var(--honey-text)' }} />
            Vinmonopolet-API · {api?.latest ? api.latest.latency_ms + ' ms' : 'ingen kall ennå'} · {api?.calls24h ?? 0} kall siste døgn
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="section">Siste aktivitet</div>
        {act.map((a, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '110px minmax(0,1fr)', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--ivory-dark)', fontSize: 14 }}>
            <div className="muted">{relTime(a.created_at, 'admin')}</div>
            <div><span style={{ fontWeight: 600 }}>{nameOf(a.actor)}</span> · {a.what}</div>
          </div>
        ))}
        {!act.length && <div className="empty">Ingen aktivitet ennå.</div>}
      </div>
    </div>
  );
}
