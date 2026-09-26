import { useQueryClient } from '@tanstack/react-query';
import { relTime } from '@vinskap/shared';
import { useState } from 'react';
import { PageHead } from '../components/common';
import { useApiHealth } from '../data';
import { vmp, VMP_QUOTA } from '../supabase';

export function Api() {
  const h = useApiHealth();
  const qc = useQueryClient();
  const [test, setTest] = useState<string | null>(null);
  const d = h.data;
  const ok = !!d?.latest && d.latest.status < 400;
  const rate = d?.calls24h ? ((d.errors24h / d.calls24h) * 100).toFixed(2).replace('.', ',') + ' %' : '—';

  const run = async () => {
    setTest('Tester …');
    try {
      const ms = await vmp.ping('test');
      setTest('OK · ' + ms + ' ms');
    } catch (e) {
      setTest((e as Error).message);
    }
    qc.invalidateQueries({ queryKey: ['api-health'] });
  };

  return (
    <div className="page">
      <PageHead label="Vinmonopolet · products v0" title="API-status" right={<button className="btn primary" onClick={run}>Test tilkobling nå</button>} />
      {test && <div style={{ padding: '12px 14px', background: 'var(--ivory-dark)', borderRadius: 4, fontSize: 14 }}>{test}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 18, border: '1px solid ' + (ok ? 'var(--sage)' : 'var(--honey-text)'), borderRadius: 4 }}>
        <span style={{ width: 12, height: 12, borderRadius: 6, background: ok ? 'var(--sage-dark)' : 'var(--honey-text)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="syne" style={{ fontWeight: 700, fontSize: 18 }}>{!d?.latest ? 'Ingen kall ennå' : ok ? 'Tilkoblet' : 'Feil · ' + d.latest.status}</span>
          <span className="muted" style={{ fontSize: 13 }}>
            Svartid {d?.latest ? d.latest.latency_ms + ' ms' : '—'} · nattlig oppdatering {d?.lastSync ? relTime(d.lastSync, 'admin') : 'ikke kjørt'}
          </span>
        </div>
      </div>
      <div className="stats">
        <div><div className="label-sm">Kall · 24 t</div><div className="stat-val" style={{ fontSize: 26 }}>{d?.calls24h ?? 0}</div></div>
        <div><div className="label-sm">Feil · 24 t</div><div className="stat-val" style={{ fontSize: 26 }}>{d?.errors24h ?? 0}</div><div className="muted" style={{ fontSize: 12 }}>{rate}</div></div>
        <div><div className="label-sm">Kvote</div><div className="stat-val" style={{ fontSize: 18, paddingTop: 6 }}>{VMP_QUOTA}</div></div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="section">Siste feil</div>
        <div style={{ padding: '12px 0', fontSize: 14, color: d?.lastError ? 'var(--red)' : 'var(--coal-soft)' }}>
          {d?.lastError ? (d.lastError.error || d.lastError.status) + ' · ' + relTime(d.lastError.at, 'admin') : 'Ingen feil registrert.'}
        </div>
      </div>
      <div className="muted" style={{ fontSize: 13, lineHeight: 1.5, maxWidth: 620 }}>
        API-nøkkelen ligger som hemmelig verdi (VMP_KEY) i Supabase og vises aldri her. Bytt den i Supabase-dashboardet.
      </div>
    </div>
  );
}
