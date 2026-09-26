import { C, relTime } from '@vinskap/shared';
import { Platform, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCellar, useHistory } from '../lib/data';
import { em, figtree, syne, t } from '../lib/theme';
import { yr } from '../lib/wine';

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { cellar } = useCellar();
  const { rows, isLoading } = useHistory(cellar?.id);
  // «HISTORIKK» i Syne 800/44 px er ~389 px bred, bredere enn 390-skjermen minus 2 × 20 px.
  // Skaler ned så ordet ikke brytes eller klippes.
  const { width } = useWindowDimensions();
  const col = Platform.OS === 'web' ? Math.min(width, 480) : width;
  const heroSize = Math.min(44, Math.floor((col - 40) / 8.9));
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 28, gap: 18 }}>
      <Text style={t.label}>Inn og ut</Text>
      <Text style={[t.hero, { fontSize: heroSize, lineHeight: heroSize, letterSpacing: -0.04 * heroSize }]}>Historikk</Text>
      <View style={{ borderTopWidth: 1, borderTopColor: C.sage }}>
        {rows.map((h) => {
          const inn = h.dir === 'in';
          return (
            <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.ivoryDark }}>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={{ ...figtree(500), fontSize: 11, letterSpacing: em(11, 0.18), textTransform: 'uppercase', color: C.coalSoft }}>
                  {inn ? 'Satt inn' : 'Tatt ut'} · {relTime(h.created_at)}{h.pending ? ' · venter' : ''}
                </Text>
                <Text style={t.name16}>{h.wine.name}</Text>
                <Text style={t.sub}>{[h.wine.producer, yr(h.wine)].filter(Boolean).join(' · ')}</Text>
              </View>
              <Text style={{ ...syne(700), fontSize: 20, color: inn ? C.sageDark : C.red, minWidth: 36, textAlign: 'right' }}>
                {(inn ? '+' : '−') + h.qty}
              </Text>
            </View>
          );
        })}
        {!isLoading && rows.length === 0 && (
          <Text style={{ paddingVertical: 40, textAlign: 'center', ...figtree(400), fontSize: 15, color: C.coalSoft }}>Ingen registreringer ennå.</Text>
        )}
      </View>
    </ScrollView>
  );
}
