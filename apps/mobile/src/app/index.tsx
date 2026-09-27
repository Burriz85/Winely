import { C, drinkStatus, initial, kr, typeColor, WINE_TYPES, type Wine } from '@vinskap/shared';
import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiLabel } from '../components/ApiSheet';
import { Bottle, Chip, Dot, Qty, WineThumb } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useCellar, useVmpStatus, useWines } from '../lib/data';
import { em, figtree, syne, t } from '../lib/theme';
import { useUI } from '../lib/ui';
import { sub, wineKey, yr } from '../lib/wine';

const FILTERS = ['Alle', ...WINE_TYPES] as const;

function Dl({ w, now }: { w: Wine; now: number }) {
  const st = drinkStatus(w.from, w.to, now);
  return <Text style={{ ...figtree(500), fontSize: 12, color: st.color }}>{st.label}</Text>;
}

function Stat({ label, value, color, first, size = 20 }: { label: string; value: string | number; color?: string; first?: boolean; size?: number }) {
  return (
    <View style={{ flex: 1, paddingVertical: 12, paddingLeft: first ? 0 : 14, borderLeftWidth: first ? 0 : 1, borderLeftColor: C.sageLight, gap: 2 }}>
      <Text style={t.labelSmall}>{label}</Text>
      <Text numberOfLines={1} style={{ ...syne(700), fontSize: size, color: color ?? C.coal }}>{value}</Text>
    </View>
  );
}

export default function CellarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, session } = useAuth();
  const { cellar, loading: cellarLoading } = useCellar();
  const { wines, isLoading } = useWines(cellar?.id);
  const { setProfileOpen, setApiOpen, listView } = useUI();
  const status = useVmpStatus(true);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Alle');
  const now = new Date().getFullYear();

  const f = useMemo(() => wines.filter((w) => {
    const h = (w.name + ' ' + w.producer + ' ' + w.region + ' ' + w.grape).toLowerCase();
    if (q && !h.includes(q.toLowerCase())) return false;
    return filter === 'Alle' || w.type === filter;
  }), [wines, q, filter]);

  const total = wines.reduce((a, w) => a + w.qty, 0);
  const ready = wines.filter((w) => now >= w.from).reduce((a, w) => a + w.qty, 0);
  const value = wines.reduce((a, w) => a + w.qty * w.price, 0);
  const open = (w: Wine) => router.navigate({ pathname: '/wine/[nr]', params: { nr: wineKey(w) } });

  const groups: { label: string; items: Wine[] }[] = [
    ...WINE_TYPES.map((ty) => ({ label: ty as string, items: f.filter((w) => w.type === ty) })),
    { label: 'Uten type', items: f.filter((w) => !w.type) },
  ].filter((g) => g.items.length);
  const readyList = f.filter((w) => now >= w.from).sort((a, b) => a.to - b.to);
  const later = f.filter((w) => now < w.from).sort((a, b) => a.from - b.from);

  if (profile?.status === 'deaktivert') {
    return (
      <View style={{ flex: 1, padding: 24, paddingTop: insets.top + 24, gap: 14 }}>
        <Text style={t.hero}>Deaktivert</Text>
        <Text style={{ ...figtree(400), fontSize: 15, lineHeight: 22, color: C.coalSoft }}>Kontoen din er deaktivert. Kontakt administrator.</Text>
      </View>
    );
  }

  const windowRow = (w: Wine, year: number, color: string) => (
    <Pressable key={wineKey(w)} onPress={() => open(w)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.ivoryDark }}>
      <Text style={{ width: 44, ...syne(700), fontSize: 15, color }}>{year}</Text>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={t.name16}>{w.name}</Text>
        <Text numberOfLines={1} style={t.sub}>{sub(w)}</Text>
      </View>
      <Text style={{ ...syne(700), fontSize: 20, color: C.coal }}>×{w.qty}</Text>
    </Pressable>
  );

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 28, gap: 18 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={t.label}>{cellar?.name ?? 'Vinskapet'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Pressable onPress={() => setApiOpen(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 10, borderWidth: 1, borderColor: C.sageLight, borderRadius: 16 }}>
            <Dot on={status.isSuccess} />
            <Text style={{ ...figtree(500), fontSize: 11, color: C.coal }}>{apiLabel(status)}</Text>
          </Pressable>
          <Pressable onPress={() => setProfileOpen(true)} accessibilityLabel="Profil"
            style={{ width: 36, height: 36, marginLeft: 6, borderRadius: 18, backgroundColor: C.sageDark, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ ...syne(700), fontSize: 15, color: C.ivory }}>{initial(profile?.name, session?.user.email)}</Text>
          </Pressable>
        </View>
      </View>

      <Text style={t.hero}>{total} flasker</Text>

      <View style={{ flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.sageLight }}>
        <Stat first label="Viner" value={wines.length} />
        <Stat label="Klar" value={ready} color={C.honeyText} />
        <Stat label="Verdi" value={kr(value)} size={18} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, paddingHorizontal: 14, borderWidth: 1, borderColor: C.sageLight, borderRadius: 4, backgroundColor: C.white }}>
        <Search size={16} color={C.coalSoft} strokeWidth={1.6} />
        <TextInput value={q} onChangeText={setQ} placeholder="Søk i skapet" placeholderTextColor={C.coalSoft + '99'}
          style={{ flex: 1, fontSize: 15, color: C.coal, ...figtree(400), outlineStyle: 'none' } as object} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        {FILTERS.map((l) => <Chip key={l} label={l} active={filter === l} onPress={() => setFilter(l)} />)}
      </ScrollView>

      {listView === 'Rader' && (
        <View>
          {groups.map((g) => (
            <View key={g.label}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 14, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: C.sage }}>
                <Text style={[t.label, { color: C.sageDark }]}>{g.label}</Text>
                <Text style={[t.label, { color: C.sageDark }]}>{g.items.reduce((a, w) => a + w.qty, 0)} fl.</Text>
              </View>
              {g.items.map((w) => (
                <Pressable key={wineKey(w)} onPress={() => open(w)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.ivoryDark }}>
                  <WineThumb wine={w} />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={t.name16}>{w.name}</Text>
                    <Text numberOfLines={1} style={t.sub}>{sub(w)}</Text>
                    <Dl w={w} now={now} />
                  </View>
                  <Qty n={w.qty} />
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      )}

      {listView === 'Kort' && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {f.map((w) => (
            <Pressable key={wineKey(w)} onPress={() => open(w)} style={{ width: '47.5%', flexGrow: 1, backgroundColor: C.ivoryDark, borderRadius: 4, overflow: 'hidden' }}>
              <View style={{ height: 96, padding: 12, backgroundColor: typeColor(w.type), flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <View style={{ justifyContent: 'space-between' }}>
                  <Text style={{ ...figtree(600), fontSize: 10, letterSpacing: em(10, 0.22), textTransform: 'uppercase', color: C.ivory }}>{yr(w)}</Text>
                  <Text style={{ ...syne(800), fontSize: 34, lineHeight: 34, color: C.ivory }}>{w.qty}</Text>
                </View>
                <View style={{ width: 48, height: 72, backgroundColor: C.white, borderRadius: 4, padding: 4 }}>
                  <Bottle uri={w.img} w="100%" h="100%" />
                </View>
              </View>
              <View style={{ paddingTop: 10, paddingHorizontal: 12, paddingBottom: 12, gap: 3 }}>
                <Text style={{ ...syne(600), fontSize: 14, lineHeight: 17, color: C.coal }}>{w.name}</Text>
                {!!w.producer && <Text style={{ ...figtree(400), fontSize: 12, color: C.coalSoft }}>{w.producer}</Text>}
                <Dl w={w} now={now} />
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {listView === 'Drikkevindu' && (
        <View style={{ gap: 20 }}>
          {readyList.length > 0 && (
            <View>
              <Text style={[t.label, { color: C.honeyText, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.honeyText }]}>Klar til å drikkes · eldst først</Text>
              {readyList.map((w) => windowRow(w, w.to, C.coalSoft))}
            </View>
          )}
          {later.length > 0 && (
            <View>
              <Text style={[t.label, { color: C.sageDark, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.sage }]}>Lagres · klar fra</Text>
              {later.map((w) => windowRow(w, w.from, C.sageDark))}
            </View>
          )}
        </View>
      )}

      {!isLoading && !cellarLoading && f.length === 0 && (
        <Text style={{ paddingVertical: 40, textAlign: 'center', ...figtree(400), fontSize: 15, color: C.coalSoft }}>
          {wines.length ? 'Ingen viner matcher.' : 'Skapet er tomt. Trykk på skanneknappen for å sette inn den første flasken.'}
        </Text>
      )}
    </ScrollView>
  );
}
