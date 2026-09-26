import { kr, relTime } from '@vinskap/shared';
import { useAdmin } from '../App';
import { PageHead, Thumb } from '../components/common';
import { useCellarItems, useCellars, useMembers, useNameOf } from '../data';

export function Cellars() {
  const { selCellar, openCellar, openUser } = useAdmin();
  const cellars = useCellars().data ?? [];
  const members = useMembers().data ?? [];
  const items = useCellarItems(selCellar);
  const nameOf = useNameOf();
  const sc = cellars.find((c) => c.id === selCellar);

  return (
    <div className="page">
      <PageHead label="Alle skap · kun lesing" title="Skap" />
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
              <button key={m.user_id} onClick={() => openUser(m.user_id)} style={{ height: 32, padding: '0 12px', border: '1px solid var(--sage-light)', borderRadius: 16, background: 'var(--ivory)', fontSize: 13, color: 'var(--coal)' }}>
                {nameOf(m.user_id)} · {m.role === 'owner' ? 'Eier' : 'Medlem'}
              </button>
            ))}
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
