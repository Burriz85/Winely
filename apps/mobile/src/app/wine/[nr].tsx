import { useQueryClient } from '@tanstack/react-query';
import { C, drinkStatus, kr, typeColor, vmpImage, vmpProductUrl } from '@vinskap/shared';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditWineSheet } from '../../components/EditWineSheet';
import { Btn, HeroBottle, Row } from '../../components/ui';
import { useCellar, useWines } from '../../lib/data';
import { supabase } from '../../lib/supabase';
import { figtree, syne, t } from '../../lib/theme';
import { useUI } from '../../lib/ui';
import { yr } from '../../lib/wine';

export default function WineScreen() {
  const { nr } = useLocalSearchParams<{ nr: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { cellar } = useCellar();
  const { wines, isLoading } = useWines(cellar?.id);
  const { setScan, flash } = useUI();
  const [editing, setEditing] = useState(false);
  const w = wines.find((x) => x.nr === nr);
  const back = () => router.navigate('/');

  if (!w) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top + 12, paddingHorizontal: 20, gap: 16 }}>
        <Pressable onPress={back} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <ChevronLeft size={16} color={C.coal} strokeWidth={1.8} />
          <Text style={{ ...figtree(500), fontSize: 13, color: C.coal }}>Skapet</Text>
        </Pressable>
        {!isLoading && <Text style={t.sub}>Vinen er ikke i skapet lenger.</Text>}
      </View>
    );
  }

  const st = drinkStatus(w.from, w.to);
  const refresh = async () => {
    const { data, error } = await supabase.functions.invoke('vmp-sync', { body: { vmp_nr: w.nr } });
    if (error || !data?.ok) return flash(data?.found === false ? 'Fant ikke varenr. ' + w.nr : 'Kunne ikke oppdatere fra Vinmonopolet');
    await qc.invalidateQueries({ queryKey: ['wines', cellar?.id] });
    flash('Oppdatert fra Vinmonopolet');
  };

  return (
    <>
    <ScrollView style={{ flex: 1 }}>
      <View style={{ height: 96 + insets.top, paddingTop: insets.top + 12, paddingHorizontal: 12, paddingBottom: 12, backgroundColor: typeColor(w.type) }}>
        <Pressable onPress={back}
          style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingLeft: 8, paddingRight: 12, borderRadius: 18, backgroundColor: 'rgba(250,250,245,0.92)' }}>
          <ChevronLeft size={16} color={C.coal} strokeWidth={1.8} />
          <Text style={{ ...figtree(500), fontSize: 13, color: C.coal }}>Skapet</Text>
        </Pressable>
      </View>
      <View style={{ paddingTop: 20, paddingHorizontal: 20, paddingBottom: 28, gap: 20 }}>
        <HeroBottle uri={w.img || vmpImage(w.nr)} />
        <View style={{ gap: 6 }}>
          <Text style={t.label}>{[w.type, w.country].filter(Boolean).join(' · ')}</Text>
          <Text style={{ ...syne(800), fontSize: 30, lineHeight: 32, letterSpacing: -0.9, color: C.coal }}>{w.name}</Text>
          <Text style={{ ...figtree(400), fontSize: 15, color: C.coalSoft }}>{[w.producer, yr(w)].filter(Boolean).join(' · ')}</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, backgroundColor: C.ivoryDark, borderRadius: 4 }}>
          <View style={{ gap: 2 }}>
            <Text style={t.labelSmall}>I skapet</Text>
            <Text style={{ ...syne(800), fontSize: 28, lineHeight: 28, color: C.coal }}>{w.qty} fl.</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn label="Ta ut" kind="outline" onPress={() => setScan({ phase: 'res', wine: w, isNew: false, qty: 1 })} />
            <Btn label="Sett inn" onPress={() => setScan({ phase: 'res', wine: w, isNew: false, qty: 1 })} />
          </View>
        </View>

        <View style={{ gap: 4 }}>
          <Text style={{ ...figtree(500), fontSize: 12, color: st.color }}>{st.label}</Text>
          <Text style={t.sub}>Drikkevindu {w.from}–{w.to}</Text>
        </View>

        {(!!w.taste || !!w.food) && (
          <View style={{ gap: 6 }}>
            <Text style={[t.label, { color: C.sageDark }]}>Smak</Text>
            {!!w.taste && <Text style={{ ...figtree(400), fontSize: 15, lineHeight: 24, color: C.coal }}>{w.taste}</Text>}
            {!!w.food && <Text style={t.sub}>Passer til: {w.food}</Text>}
          </View>
        )}

        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: C.sage }}>
            <Text style={[t.label, { color: C.sageDark }]}>Fra Vinmonopolet</Text>
            <Text style={{ ...figtree(400), fontSize: 12, color: C.coalSoft }}>Varenr. {w.nr}</Text>
          </View>
          <Row k="Pris" v={w.price ? kr(w.price) : ''} />
          <Row k="Distrikt" v={w.region} />
          <Row k="Druer" v={w.grape} />
          <Row k="Alkohol" v={w.abv} />
          <Row k="Verdi i skapet" v={kr(w.price * w.qty)} last />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 12 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Btn label="Endre" kind="sage" size={13} pad={14} onPress={() => setEditing(true)} />
              <Btn label="Oppdater fra API" kind="sage" size={13} pad={14} onPress={refresh} />
            </View>
            <Pressable onPress={() => Linking.openURL(vmpProductUrl(w.nr))}>
              <Text style={{ ...figtree(600), fontSize: 14, color: C.sageDark }}>vinmonopolet.no →</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ScrollView>
    {editing && cellar && <EditWineSheet wine={w} cellarId={cellar.id} onClose={() => setEditing(false)} />}
    </>
  );
}
