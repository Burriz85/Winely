import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Wine } from '@vinskap/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type ListView = 'Rader' | 'Kort' | 'Drikkevindu';

export type Scan =
  | { phase: 'cam' }
  | { phase: 'lookup'; ean: string }
  | { phase: 'res'; wine: Wine; isNew: boolean; qty: number; /** strekkode som skal kobles */ ean?: string; /** strekkoden som ble skannet */ scanned?: string };

export type Search = { ean?: string; prefill?: string; /** søk med en gang */ autorun?: boolean };
/** Vin som ikke finnes hos Vinmonopolet. */
export type Manual = { ean?: string; name?: string };

type UI = {
  toast: string | null;
  flash: (m: string) => void;
  scan: Scan | null;
  setScan: (s: Scan | null | ((p: Scan | null) => Scan | null)) => void;
  search: Search | null;
  setSearch: (s: Search | null) => void;
  manual: Manual | null;
  setManual: (m: Manual | null) => void;
  profileOpen: boolean;
  setProfileOpen: (v: boolean) => void;
  apiOpen: boolean;
  setApiOpen: (v: boolean) => void;
  listView: ListView;
  setListView: (v: ListView) => void;
};

const Ctx = createContext<UI | null>(null);
const VIEW_KEY = 'vinskap.view';

export function UIProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<string | null>(null);
  const [scan, setScan] = useState<Scan | null>(null);
  const [search, setSearch] = useState<Search | null>(null);
  const [manual, setManual] = useState<Manual | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [apiOpen, setApiOpen] = useState(false);
  const [listView, setLV] = useState<ListView>('Rader');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    AsyncStorage.getItem(VIEW_KEY).then((v) => {
      if (v === 'Rader' || v === 'Kort' || v === 'Drikkevindu') setLV(v);
    }).catch(() => {});
    return () => clearTimeout(timer.current);
  }, []);

  // Toasten står i 2,4 s (handoff).
  const flash = useCallback((m: string) => {
    clearTimeout(timer.current);
    setToast(m);
    timer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  const setListView = useCallback((v: ListView) => {
    setLV(v);
    AsyncStorage.setItem(VIEW_KEY, v).catch(() => {});
  }, []);

  const value = useMemo(() => ({
    toast, flash, scan, setScan, search, setSearch, manual, setManual, profileOpen, setProfileOpen, apiOpen, setApiOpen, listView, setListView,
  }), [toast, flash, scan, search, manual, profileOpen, apiOpen, listView, setListView]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUI() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useUI utenfor UIProvider');
  return v;
}
