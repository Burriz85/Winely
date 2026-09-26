import { Search } from 'lucide-react';
import type { Status } from '../data';

export function SearchBox({ value, onChange, placeholder, maxWidth }: { value: string; onChange: (v: string) => void; placeholder: string; maxWidth?: number }) {
  return (
    <div className="search" style={{ maxWidth }}>
      <Search size={16} color="#4A403A" strokeWidth={1.6} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

export function Chips({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map((o) => <button key={o} className={'chip' + (o === value ? ' on' : '')} onClick={() => onChange(o)}>{o}</button>)}
    </div>
  );
}

export const StatusPill = ({ s }: { s: Status }) => <span className={'pill ' + s}>{s.charAt(0).toUpperCase() + s.slice(1)}</span>;

export function PageHead({ label, title, right }: { label: string; title: string; right?: React.ReactNode }) {
  const head = (
    <div className="page-head">
      <div className="label">{label}</div>
      <div className="hero">{title}</div>
    </div>
  );
  return right ? <div className="head-row">{head}{right}</div> : head;
}

export function Thumb({ nr, img }: { nr: string; img?: string }) {
  const src = img || (nr ? `https://bilder.vinmonopolet.no/cache/300x300-0/${nr}-1.jpg` : '');
  return <div style={{ width: 32, height: 48, flexShrink: 0, borderRadius: 2, background: src ? `#FFFFFF url(${src}) center/contain no-repeat` : '#FFFFFF' }} />;
}
