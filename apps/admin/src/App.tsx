import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { InviteModal } from './components/InviteModal';
import { UserDrawer } from './components/UserDrawer';
import { useDupes, useEans, useUsers } from './data';
import { Activity } from './pages/Activity';
import { Api } from './pages/Api';
import { Cellars } from './pages/Cellars';
import { Dupes } from './pages/Dupes';
import { Eans } from './pages/Eans';
import { Login } from './pages/Login';
import { Overview } from './pages/Overview';
import { Users } from './pages/Users';
import { supabase } from './supabase';

export type Tab = 'overview' | 'users' | 'cellars' | 'eans' | 'dupes' | 'activity' | 'api';
const TABS: [Tab, string, string][] = [
  ['overview', 'Oversikt', ''], ['users', 'Brukere', 'brukere'], ['cellars', 'Skap', 'skap'], ['eans', 'Strekkoder', 'strekkoder'],
  ['dupes', 'Duplikater', 'duplikater'], ['activity', 'Aktivitet', 'aktivitet'], ['api', 'API-status', 'api'],
];
const tabFromHash = (): Tab => TABS.find(([, , slug]) => location.hash.replace(/^#\/?/, '') === slug)?.[0] ?? 'overview';

type Ctx = {
  tab: Tab;
  go: (t: Tab, opts?: { userFilter?: string }) => void;
  userFilter: string;
  setUserFilter: (f: string) => void;
  openUser: (id: string | null) => void;
  selCellar: string | null;
  openCellar: (id: string | null) => void;
  openInvite: () => void;
  flash: (m: string) => void;
  narrow: boolean;
  me: Session['user'];
};
const AdminCtx = createContext<Ctx | null>(null);
export const useAdmin = () => {
  const v = useContext(AdminCtx);
  if (!v) throw new Error('useAdmin utenfor App');
  return v;
};

function useWidth() {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return w;
}

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    setIsAdmin(null);
    if (session) supabase.rpc('is_admin').then(({ data }) => setIsAdmin(!!data));
  }, [session?.user.id]);

  if (session === undefined || (session && isAdmin === null)) return null;
  if (!session) return <Login />;
  if (!isAdmin) return <Login denied email={session.user.email ?? ''} />;
  return <Shell me={session.user} />;
}

function Shell({ me }: { me: Session['user'] }) {
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [userFilter, setUserFilter] = useState('Alle');
  const [sel, setSel] = useState<string | null>(null);
  const [selCellar, setSelCellar] = useState<string | null>(null);
  const [invite, setInvite] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const narrow = useWidth() < 860;

  const users = useUsers();
  const eans = useEans();
  const dupes = useDupes();

  useEffect(() => {
    const on = () => setTab(tabFromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const flash = useCallback((m: string) => {
    clearTimeout(timer.current);
    setToast(m);
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const go = useCallback((t: Tab, opts?: { userFilter?: string }) => {
    location.hash = '/' + (TABS.find(([k]) => k === t)?.[2] ?? '');
    setTab(t);
    setSel(null);
    setSelCellar(null);
    if (opts?.userFilter) setUserFilter(opts.userFilter);
  }, []);

  const invited = users.data?.filter((u) => u.status === 'invitert').length ?? 0;
  const conflicts = new Set(eans.data?.filter((e) => e.conflict).map((e) => e.ean)).size;
  const badges: Partial<Record<Tab, number>> = { users: invited, eans: conflicts, dupes: dupes.data?.length ?? 0 };

  const ctx: Ctx = {
    tab, go, userFilter, setUserFilter, openUser: setSel, selCellar, openCellar: setSelCellar,
    openInvite: () => setInvite(true), flash, narrow, me,
  };

  const page: Record<Tab, ReactNode> = {
    overview: <Overview />, users: <Users />, cellars: <Cellars />, eans: <Eans />, dupes: <Dupes />, activity: <Activity />, api: <Api />,
  };

  return (
    <AdminCtx.Provider value={ctx}>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'row', flexWrap: 'wrap', background: 'var(--ivory)' }}>
        <nav style={narrow
          ? { width: '100%', display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 16px 12px', borderBottom: '1px solid var(--sage-light)', position: 'sticky', top: 0, background: 'var(--ivory)', zIndex: 10 }
          : { width: 232, flexShrink: 0, alignSelf: 'flex-start', display: 'flex', flexDirection: 'column', gap: 24, padding: '28px 16px', borderRight: '1px solid var(--sage-light)', position: 'sticky', top: 0, height: '100vh', background: 'var(--ivory)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px' }}>
            <img src="/monogram-bg-sage.png" alt="B & G" style={{ width: 36, height: 36, objectFit: 'contain' }} />
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div className="syne" style={{ fontWeight: 800, fontSize: 16, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>Vinskap</div>
              <div className="label-sm">Admin</div>
            </div>
            {narrow && <button className="link-btn" style={{ fontSize: 13 }} onClick={() => supabase.auth.signOut()}>Logg ut</button>}
          </div>
          <div style={narrow ? { display: 'flex', gap: 4, overflowX: 'auto', margin: '0 -16px', padding: '0 16px' } : { display: 'flex', flexDirection: 'column', gap: 2 }}>
            {TABS.map(([k, label]) => {
              const b = badges[k];
              const on = tab === k;
              return (
                <button key={k} onClick={() => go(k)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, height: 40, padding: '0 12px', border: 0, borderRadius: 4,
                  fontSize: 14, fontWeight: on ? 600 : 500, whiteSpace: 'nowrap', flexShrink: 0,
                  background: on ? 'var(--sage-tint)' : 'transparent', color: on ? 'var(--sage-dark)' : 'var(--coal)', width: narrow ? 'auto' : '100%',
                }}>
                  <span>{label}</span>
                  {!!b && (
                    <span style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 10, background: 'var(--honey-text)', color: 'var(--ivory)', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{b}</span>
                  )}
                </button>
              );
            })}
          </div>
          {!narrow && (
            <div style={{ marginTop: 'auto', padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 12, color: 'var(--coal-soft)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{me.email}</div>
              <button className="link-btn" style={{ textAlign: 'left', fontSize: 13, fontWeight: 600, color: 'var(--sage-dark)' }} onClick={() => supabase.auth.signOut()}>Logg ut</button>
            </div>
          )}
        </nav>
        <main style={{ flex: 1, minWidth: 0, padding: '32px clamp(16px,4vw,48px) 64px', display: 'flex', flexDirection: 'column', gap: 28 }}>
          {page[tab]}
        </main>
        {sel && <UserDrawer id={sel} onClose={() => setSel(null)} />}
        {invite && <InviteModal onClose={() => setInvite(false)} />}
        {toast && (
          <div style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', padding: '14px 18px', borderRadius: 4, background: 'var(--coal)', color: 'var(--ivory)', fontSize: 14, fontWeight: 500, zIndex: 60, maxWidth: 'calc(100vw - 32px)' }}>{toast}</div>
        )}
      </div>
    </AdminCtx.Provider>
  );
}
