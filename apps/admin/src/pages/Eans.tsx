import { useQueryClient } from '@tanstack/react-query';
import { relTime } from '@vinskap/shared';
import { useState } from 'react';
import { useAdmin } from '../App';
import { PageHead, SearchBox } from '../components/common';
import { useEans, useNameOf, type EanRow } from '../data';
import { logAdmin, supabase, vmp } from '../supabase';

/** Finn produktet for et varenummer, eller opprett det med navn fra Vinmonopolet. */
async function productFor(nr: string): Promise<string> {
  const { data } = await supabase.from('products').select('id').eq('vmp_nr', nr).maybeSingle();
  if (data) return data.id;
  const w = await vmp.byId(nr);
  if (!w) throw new Error('Fant ikke varenr. ' + nr + ' hos Vinmonopolet');
  const ins = await supabase.from('products').insert({ vmp_nr: nr, name: w.name, image_url: w.img }).select('id').single();
  if (ins.error) throw new Error(ins.error.message);
  return ins.data.id;
}

export function Eans() {
  const { narrow, flash } = useAdmin();
  const qc = useQueryClient();
  const eans = useEans();
  const nameOf = useNameOf();
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<{ key: string; nr: string } | null>(null);
  const key = (e: EanRow) => e.ean + ':' + e.product_id;
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['eans'] }), qc.invalidateQueries({ queryKey: ['activity'] })]);

  const fail = (m: string) => { flash(m); return refresh(); };

  // Fjern ett par (strekkode, vin): forslaget, og koblingen hvis det var den.
  const remove = async (e: EanRow) => {
    const s = await supabase.from('ean_suggestions').delete().eq('ean', e.ean).eq('product_id', e.product_id);
    if (s.error) return fail(s.error.message);
    if (e.mapped) {
      const m = await supabase.from('ean_map').delete().eq('ean', e.ean);
      if (m.error) return fail(m.error.message);
    }
    await logAdmin('Fjernet strekkode', e.ean + ' → ' + (e.vmp_nr ?? '?'));
    flash('Kobling fjernet');
    refresh();
  };

  // «Behold denne»: koble strekkoden til denne vinen og fjern de andre forslagene.
  const keep = async (e: EanRow) => {
    const m = await supabase.from('ean_map').upsert({ ean: e.ean, product_id: e.product_id, source: 'admin', created_by: (await supabase.auth.getUser()).data.user?.id }, { onConflict: 'ean' });
    if (m.error) return fail(m.error.message);
    const s = await supabase.from('ean_suggestions').delete().eq('ean', e.ean).neq('product_id', e.product_id);
    if (s.error) return fail(s.error.message);
    await logAdmin('Løste konflikt', e.ean + ' → ' + (e.vmp_nr ?? '?'));
    flash('Beholdt ' + e.vmp_nr + ' for ' + e.ean);
    refresh();
  };

  const save = async (e: EanRow) => {
    const nr = (edit?.nr ?? '').trim();
    if (!/^\d{1,12}$/.test(nr)) return flash('Skriv inn et gyldig varenummer');
    try {
      const pid = await productFor(nr);
      const me = (await supabase.auth.getUser()).data.user?.id;
      await supabase.from('ean_suggestions').delete().eq('ean', e.ean).eq('product_id', e.product_id);
      await supabase.from('ean_suggestions').upsert({ ean: e.ean, product_id: pid, created_by: me }, { onConflict: 'ean,product_id' });
      if (e.mapped) {
        const m = await supabase.from('ean_map').update({ product_id: pid, source: 'admin' }).eq('ean', e.ean);
        if (m.error) throw new Error(m.error.message);
      }
      await logAdmin('Endret strekkode', e.ean + ' → ' + nr);
      setEdit(null);
      flash('Kobling oppdatert');
      refresh();
    } catch (err) {
      flash((err as Error).message);
    }
  };

  const rows = (eans.data ?? []).filter((e) => !q || (e.ean + ' ' + (e.vmp_nr ?? '') + ' ' + e.name).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="page">
      <PageHead label="Strekkode → varenummer" title="Strekkoder" />
      <SearchBox value={q} onChange={setQ} placeholder="Strekkode, varenr. eller navn" maxWidth={480} />
      <div className="rows">
        {rows.map((e) => {
          const editing = edit?.key === key(e);
          return (
            <div key={key(e)} style={{
              display: 'grid', gridTemplateColumns: narrow ? 'minmax(0,1fr)' : 'minmax(0,1.3fr) minmax(0,2fr) minmax(0,1.3fr) auto', gap: '8px 16px', alignItems: 'center',
              padding: '14px 12px', margin: '0 -12px', borderBottom: '1px solid var(--ivory-dark)', background: e.conflict ? 'var(--honey-tint)' : 'transparent', borderRadius: 4,
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 14 }}>{e.ean}</span>
                {e.conflict && <span style={{ fontSize: 12, color: 'var(--red)', fontWeight: 500 }}>Samme strekkode registrert på flere viner</span>}
              </div>
              {editing ? (
                <input className="field" autoFocus value={edit.nr} onChange={(ev) => setEdit({ key: edit.key, nr: ev.target.value })} placeholder="Varenummer"
                  onKeyDown={(ev) => ev.key === 'Enter' && save(e)} style={{ height: 40, fontSize: 14, borderColor: 'var(--sage-dark)', padding: '0 12px' }} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{e.name}</span>
                  <span className="muted" style={{ fontSize: 12 }}>Varenr. {e.vmp_nr ?? '—'}{e.conflict && e.mapped ? ' · brukes nå' : ''}</span>
                </div>
              )}
              <div className="muted" style={{ fontSize: 13 }}>{nameOf(e.created_by)} · {relTime(e.created_at, 'admin')} · {e.hits} skann</div>
              <div style={{ display: 'flex', gap: 6, justifyContent: narrow ? 'flex-start' : 'flex-end', flexWrap: 'nowrap' }}>
                {editing ? (
                  <>
                    <button className="btn" onClick={() => setEdit(null)}>Avbryt</button>
                    <button className="btn primary" onClick={() => save(e)}>Lagre</button>
                  </>
                ) : (
                  <>
                    {e.conflict && <button className="btn primary" onClick={() => keep(e)}>Behold denne</button>}
                    <button className="btn" onClick={() => setEdit({ key: key(e), nr: e.vmp_nr ?? '' })}>Endre</button>
                    <button className="btn danger" onClick={() => remove(e)}>Fjern</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {eans.isSuccess && !rows.length && <div className="empty">Ingen strekkoder.</div>}
      </div>
    </div>
  );
}
