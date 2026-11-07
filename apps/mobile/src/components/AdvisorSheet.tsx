import { C, drinkStatus, type Wine } from '@vinskap/shared';
import { useRouter } from 'expo-router';
import { ChevronRight, Sparkles } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { askAdvisor, MAX_QUESTION, type AdvisorAnswer } from '../lib/advisor';
import { useCellar, useWines } from '../lib/data';
import { figtree, syne, t } from '../lib/theme';
import { useUI } from '../lib/ui';
import { sub, wineKey } from '../lib/wine';
import { Sheet } from './Sheet';
import { Btn, Chip, WineThumb } from './ui';

const IDEAS = ['Biff', 'Lam', 'Fisk', 'Skalldyr', 'Pizza', 'Ost', 'Aperitiff', 'Gave'];

export function AdvisorSheet() {
  const { advisorOpen, setAdvisorOpen } = useUI();
  const { cellar } = useCellar();
  const { wines } = useWines(cellar?.id);
  const router = useRouter();
  const [q, setQ] = useState('');
  const [asked, setAsked] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<AdvisorAnswer | null>(null);

  useEffect(() => { if (!advisorOpen) setBusy(false); }, [advisorOpen]);
  if (!advisorOpen) return null;

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || !cellar || busy) return;
    setQ(text); setAsked(text); setBusy(true); setError(null); setAnswer(null);
    try {
      setAnswer(await askAdvisor(cellar.id, text));
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  const open = (w: Wine) => {
    setAdvisorOpen(false);
    router.navigate({ pathname: '/wine/[nr]', params: { nr: wineKey(w) } });
  };

  // Svaret viser vinene slik de står i skapet nå. En vin som er tatt ut siden, vises ikke.
  const picked = (answer?.picks ?? [])
    .map((p) => ({ p, w: wines.find((w) => w.productId === p.product_id) }))
    .filter((x): x is { p: typeof x.p; w: Wine } => !!x.w);
  const now = new Date().getFullYear();

  return (
    <Sheet onClose={() => setAdvisorOpen(false)} gap={16}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Sparkles size={20} color={C.sageDark} strokeWidth={1.6} />
        <Text style={{ ...syne(700), fontSize: 22, textTransform: 'uppercase', color: C.coal }}>Vinrådgiver</Text>
      </View>
      <Text style={{ ...figtree(400), fontSize: 14, lineHeight: 21, color: C.coalSoft }}>
        Skriv hva vinen skal brukes til, så foreslår jeg flasker fra {cellar?.name ? `«${cellar.name}»` : 'skapet'}.
      </Text>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput value={q} onChangeText={setQ} onSubmitEditing={() => ask(q)} returnKeyType="send" maxLength={MAX_QUESTION}
          placeholder="F.eks. entrecôte med bearnaise" placeholderTextColor={C.coalSoft + '99'} autoFocus
          style={{ flex: 1, height: 44, paddingHorizontal: 14, borderWidth: 1, borderColor: C.sageLight, borderRadius: 4, backgroundColor: C.white, fontSize: 15, color: C.coal, ...figtree(400), outlineStyle: 'none' } as object} />
        <Btn label="Spør" onPress={() => ask(q)} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }} keyboardShouldPersistTaps="handled">
        {IDEAS.map((l) => <Chip key={l} label={l} active={asked === l} onPress={() => ask(l)} />)}
      </ScrollView>

      {busy && <Text style={{ paddingVertical: 24, textAlign: 'center', ...figtree(400), fontSize: 14, color: C.coalSoft }}>Ser gjennom skapet …</Text>}

      {!busy && error && (
        <View style={{ padding: 14, borderWidth: 1, borderColor: C.red, borderRadius: 4 }}>
          <Text style={{ ...figtree(400), fontSize: 14, lineHeight: 21, color: C.red }}>{error}</Text>
        </View>
      )}

      {!busy && answer && (
        <View style={{ gap: 4 }}>
          {!!answer.summary && <Text style={{ ...figtree(400), fontSize: 15, lineHeight: 22, color: C.coal, paddingBottom: 6 }}>{answer.summary}</Text>}
          {picked.map(({ p, w }) => {
            const st = drinkStatus(w.from, w.to, now);
            return (
              <Pressable key={p.product_id} onPress={() => open(w)}
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.ivoryDark }}>
                <WineThumb wine={w} />
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <Text style={t.name16}>{w.name}</Text>
                  <Text numberOfLines={1} style={t.sub}>{sub(w)}</Text>
                  <Text style={{ ...figtree(500), fontSize: 12, color: st.color }}>{st.label} · {w.qty} fl.</Text>
                  {!!p.reason && <Text style={{ ...figtree(400), fontSize: 14, lineHeight: 20, color: C.coal, marginTop: 4 }}>{p.reason}</Text>}
                </View>
                <ChevronRight size={16} color={C.coalSoft} strokeWidth={1.6} style={{ marginTop: 22 }} />
              </Pressable>
            );
          })}
          <Text style={{ ...figtree(400), fontSize: 12, lineHeight: 18, color: C.coalSoft, paddingTop: 8 }}>
            Forslagene lages av KI ut fra det som er registrert om vinene. Smak og skjønn går foran.
          </Text>
        </View>
      )}
    </Sheet>
  );
}
