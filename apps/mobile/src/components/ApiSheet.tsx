import { useQueryClient } from '@tanstack/react-query';
import { C } from '@vinskap/shared';
import { Text, View } from 'react-native';
import { useVmpStatus } from '../lib/data';
import { figtree, syne } from '../lib/theme';
import { useUI } from '../lib/ui';
import { Sheet } from './Sheet';
import { Btn, Dot } from './ui';

export const apiLabel = (s: ReturnType<typeof useVmpStatus>) =>
  s.isFetching && !s.data ? 'Vinmonopolet · sjekker' : s.isSuccess ? 'Vinmonopolet · tilkoblet' : 'Vinmonopolet · frakoblet';

/**
 * I prototypen limte brukeren inn API-nøkkelen her. Handoff sier at nøkkelen ikke skal ligge
 * i klienten, så arket viser status for proxyen i stedet.
 */
export function ApiSheet() {
  const { apiOpen, setApiOpen } = useUI();
  const status = useVmpStatus(true);
  const qc = useQueryClient();
  if (!apiOpen) return null;
  return (
    <Sheet onClose={() => setApiOpen(false)} gap={16}>
      <Text style={{ ...syne(700), fontSize: 22, textTransform: 'uppercase', color: C.coal }}>Vinmonopolet-API</Text>
      <Text style={{ ...figtree(400), fontSize: 14, lineHeight: 21, color: C.coalSoft }}>
        Produktdata hentes fra Vinmonopolet via Vinskap-serveren. API-nøkkelen ligger på serveren og vises aldri i appen.
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: C.ivoryDark, borderRadius: 4 }}>
        <Dot on={status.isSuccess} />
        <Text style={{ ...figtree(400), fontSize: 14, color: C.coal, flex: 1 }}>
          {apiLabel(status)}{status.isSuccess ? ' · ' + status.data + ' ms' : ''}
        </Text>
      </View>
      {status.isError && <Text style={{ ...figtree(400), fontSize: 13, color: C.red }}>{(status.error as Error).message}</Text>}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Btn label="Lukk" kind="outline" height={52} size={15} style={{ flex: 1 }} onPress={() => setApiOpen(false)} />
        <Btn label="Test nå" height={52} size={15} style={{ flex: 1 }} onPress={() => qc.invalidateQueries({ queryKey: ['vmp-status'] })} />
      </View>
    </Sheet>
  );
}
