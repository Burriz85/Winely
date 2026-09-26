import { useQueryClient } from '@tanstack/react-query';
import { useAdmin } from '../App';
import { PageHead } from '../components/common';
import { useDupes } from '../data';
import { supabase } from '../supabase';

export function Dupes() {
  const { flash } = useAdmin();
  const qc = useQueryClient();
  const dupes = useDupes();
  const done = () => ['dupes', 'cellars', 'activity', 'eans'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  return (
    <div className="page">
      <PageHead label="Mulige dobbeltregistreringer" title="Duplikater" />
      <div className="muted" style={{ fontSize: 14, lineHeight: 1.5, maxWidth: 620 }}>
        Når to viner slås sammen, flyttes beholdning, historikk og strekkoder til vinen til venstre. Den til høyre slettes.
      </div>
      {dupes.isSuccess && !dupes.data.length && <div className="empty">Ingen duplikater å se på.</div>}
      {(dupes.data ?? []).map((d) => (
        <div key={d.keep_id + d.merge_id} style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 18, border: '1px solid var(--sage-light)', borderRadius: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--honey-text)' }}>{d.reason}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, alignItems: 'stretch' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 14, background: 'var(--sage-tint)', borderRadius: 4 }}>
              <div className="label-sm" style={{ color: 'var(--sage-dark)' }}>Beholdes</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{d.keep_name}</div>
              <div className="muted" style={{ fontSize: 13 }}>{d.keep_nr ?? 'Uten varenr.'} · {d.keep_cellars} skap · {d.keep_bottles} fl.</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 14, background: 'var(--ivory-dark)', borderRadius: 4 }}>
              <div className="label-sm">Slås inn</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{d.merge_name}</div>
              <div className="muted" style={{ fontSize: 13 }}>Uten varenr. · {d.merge_cellars} skap · {d.merge_bottles} fl.</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button className="btn" onClick={async () => {
              const { error } = await supabase.from('dupe_ignores').insert({ keep_id: d.keep_id, merge_id: d.merge_id });
              flash(error ? error.message : 'Markert som ikke duplikat');
              done();
            }}>Ikke duplikat</button>
            <button className="btn primary" onClick={async () => {
              const { error } = await supabase.rpc('admin_merge_products', { p_keep: d.keep_id, p_merge: d.merge_id });
              flash(error ? error.message : 'Slo sammen «' + d.merge_name + '» inn i «' + d.keep_name + '»');
              done();
            }}>Slå sammen</button>
          </div>
        </div>
      ))}
    </div>
  );
}
