import { C, type Wine } from '@vinskap/shared';
import { ChevronRight, Search as SearchIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { productToWine, useCellar, useWines } from '../lib/data';
import { supabase } from '../lib/supabase';
import { figtree, syne, t } from '../lib/theme';
import { useUI } from '../lib/ui';
import { offName, previewDetails, vmp } from '../lib/vmp';
import { sub } from '../lib/wine';
import { Btn, LinkBtn, WineThumb } from './ui';

export function SearchOverlay() {
  const { search, setSearch, setScan, setManual } = useUI();
  const { cellar } = useCellar();
  const { wines } = useWines(cellar?.id);
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [results, setResults] = useState<Wine[]>([]);
  const ean = search?.ean;

  useEffect(() => {
    if (!search) return;
    setQ(search.prefill ?? ''); setResults([]); setDone(false); setError(null);
    // Valgfritt (handoff): Open Food Facts fyller ut søkefeltet for ukjente strekkoder.
    if (search.ean && !search.prefill) offName(search.ean).then((n) => n && setQ((cur) => cur || n));
    if (search.autorun && search.prefill) runQuery(search.prefill);
  }, [search]);

  if (!search) return null;

  const run = () => runQuery(q);
  async function runQuery(query: string) {
    if (!query.trim()) return;
    setLoading(true); setError(null);
    try {
      setResults(await vmp.search(query));
    } catch (e) {
      setError((e as Error).message);
      setResults([]);
    }
    setLoading(false); setDone(true);
  }

  const pick = async (r: Wine) => {
    const have = wines.find((w) => w.nr === r.nr);
    let wine: Wine = have ?? r;
    if (!have) {
      setLoading(true);
      // Finnes produktet fra før (en annen bruker har lagt det inn), gjenbrukes type, årgang og pris.
      const { data } = await supabase.from('products').select('*').eq('vmp_nr', r.nr).maybeSingle();
      if (data) wine = { ...productToWine(data), name: r.name };
      // Fyll inn fra vinmonopolet.no der vi ikke har data fra før.
      const d = await previewDetails(r.nr);
      if (d) {
        const base = wine;
        const fill = Object.fromEntries(Object.entries(d).filter(([k]) => !base[k as keyof Wine] || k === 'from' || k === 'to'));
        wine = { ...base, ...fill };
      }
      setLoading(false);
    }
    setSearch(null);
    setScan({ phase: 'res', wine, isNew: !have, qty: 1, ean });
  };

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 25, backgroundColor: C.ivory, paddingTop: insets.top }}>
      <View style={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: 12, gap: 14, borderBottomWidth: 1, borderBottomColor: C.sageLight }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[t.label, { color: C.sageDark }]}>{ean ? 'Hvilken vin er dette?' : 'Søk i Vinmonopolet'}</Text>
          <LinkBtn label="Lukk" color={C.coal} onPress={() => setSearch(null)} />
        </View>
        {ean && <Text style={{ ...figtree(400), fontSize: 13, color: C.coalSoft, marginTop: -6 }}>Strekkode {ean} · søk opp vinen, så husker Vinskap den neste gang.</Text>}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, paddingHorizontal: 14, borderWidth: 1, borderColor: C.sageLight, borderRadius: 4, backgroundColor: C.white }}>
            <SearchIcon size={16} color={C.coalSoft} strokeWidth={1.6} />
            <TextInput value={q} onChangeText={setQ} onSubmitEditing={run} returnKeyType="search" autoFocus
              placeholder="Navn eller produsent" placeholderTextColor={C.coalSoft + '99'}
              style={{ flex: 1, fontSize: 15, color: C.coal, ...figtree(400), outlineStyle: 'none' } as object} />
          </View>
          <Btn label="Søk" onPress={run} />
        </View>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        {loading && <Text style={{ paddingVertical: 32, textAlign: 'center', ...figtree(400), fontSize: 14, color: C.coalSoft }}>Henter fra Vinmonopolet …</Text>}
        {!loading && error && (
          <View style={{ marginTop: 16, padding: 14, borderWidth: 1, borderColor: C.red, borderRadius: 4 }}>
            <Text style={{ ...figtree(400), fontSize: 14, lineHeight: 21, color: C.red }}>{error}</Text>
          </View>
        )}
        {!loading && done && !error && !results.length && (
          <Text style={{ paddingVertical: 32, textAlign: 'center', ...figtree(400), fontSize: 14, color: C.coalSoft }}>Ingen treff.</Text>
        )}
        {!loading && results.map((r) => (
          <Pressable key={r.nr} onPress={() => pick(r)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.ivoryDark }}>
            <WineThumb wine={r} stripe={false} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={{ ...syne(600), fontSize: 16, lineHeight: 19, color: C.coal }}>{r.name}</Text>
              <Text numberOfLines={1} style={{ ...figtree(400), fontSize: 13, color: C.coalSoft }}>{sub(r)}</Text>
              <Text style={{ ...figtree(400), fontSize: 12, color: C.coalSoft }}>Varenr. {r.nr}</Text>
            </View>
            <ChevronRight size={16} color={C.coalSoft} strokeWidth={1.6} />
          </Pressable>
        ))}
        {!loading && (done || !!ean) && (
          <LinkBtn label="Finner du ikke vinen? Legg den inn selv" size={14} style={{ alignSelf: 'center', marginTop: 16 }}
            onPress={() => { setSearch(null); setManual({ ean, name: q.trim() }); }} />
        )}
      </ScrollView>
    </View>
  );
}
