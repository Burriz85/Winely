import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authError, supabase } from './supabase';

export type Profile = { id: string; name: string; status: 'aktiv' | 'deaktivert'; is_admin: boolean };

type Auth = {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  /** Brukeren bytter passordet admin ga hen. */
  changePassword: (password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const uid = session?.user.id;
  useEffect(() => {
    if (!uid) return setProfile(null);
    supabase.from('profiles').select('id,name,status,is_admin').eq('id', uid).maybeSingle()
      .then(({ data }) => setProfile((data as Profile) ?? null));
  }, [uid]);

  const value = useMemo<Auth>(() => ({
    ready, session, profile,
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? authError(error.message) : null;
    },
    async changePassword(password) {
      const { error } = await supabase.auth.updateUser({ password });
      return error ? authError(error.message) : null;
    },
    async signOut() {
      await supabase.auth.signOut();
    },
  }), [ready, session, profile]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth utenfor AuthProvider');
  return v;
}
