import { useQueryClient } from '@tanstack/react-query';
import { C, WINE_TYPES, type Wine, type WineType } from '@vinskap/shared';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { figtree, syne } from '../lib/theme';
import { useUI } from '../lib/ui';
import { Sheet } from './Sheet';
import { Btn, Chip, NumField } from './ui';

/**
 * Rett opp type, årgang, pris og drikkevindu. API-et gir bare navn og varenummer,
 * så dette er eneste måte å fylle inn og rette disse feltene på.
 * Type, årgang og pris deles med andre skap som har samme vin; drikkevinduet gjelder bare dette skapet.
 */
export function EditWineSheet({ wine, cellarId, onClose }: { wine: Wine; cellarId: string; onClose: () => void }) {
  const { flash } = useUI();
  const qc = useQueryClient();
  const [type, setType] = useState<WineType | null>(wine.type);
  const [year, setYear] = useState<number | null>(wine.year);
  const [price, setPrice] = useState<number | null>(wine.price || null);
  const [from, setFrom] = useState<number | null>(wine.from);
  const [to, setTo] = useState<number | null>(wine.to);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!type) return flash('Velg type');
    if (from && to && from > to) return flash('Drikkevinduet slutter før det starter');
    setBusy(true);
    const { error } = await supabase.rpc('update_wine', {
      p_cellar: cellarId, p_product: wine.productId, p_type: type, p_vintage: year, p_price: price, p_from: from, p_to: to,
    });
    setBusy(false);
    if (error) return flash('Kunne ikke lagre: ' + error.message);
    await qc.invalidateQueries({ queryKey: ['wines', cellarId] });
    qc.invalidateQueries({ queryKey: ['history', cellarId] });
    flash('Lagret');
    onClose();
  };

  const label14 = { ...figtree(500), fontSize: 14, color: C.coal };
  const row = { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: 12 };
  return (
    <Sheet onClose={onClose} gap={14}>
      <Text style={{ ...syne(700), fontSize: 22, textTransform: 'uppercase', color: C.coal }}>Endre vin</Text>
      <Text style={{ ...figtree(400), fontSize: 13, lineHeight: 19, color: C.coalSoft }}>
        Vinmonopolet-API-et gir bare navn og varenummer. Type, årgang og pris deles med andre som har samme vin.
      </Text>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {WINE_TYPES.map((ty) => <Chip key={ty} label={ty} pad={12} active={type === ty} onPress={() => setType(ty)} />)}
      </View>
      <View style={row}><Text style={label14}>Årgang</Text><NumField value={year} placeholder="NV" onChange={setYear} /></View>
      <View style={row}><Text style={label14}>Pris per flaske</Text><NumField value={price} placeholder="kr" onChange={setPrice} /></View>
      <View style={row}>
        <Text style={label14}>Drikkevindu</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <NumField width={72} value={from} placeholder="Fra" onChange={setFrom} />
          <Text style={label14}>–</Text>
          <NumField width={72} value={to} placeholder="Til" onChange={setTo} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
        <Btn label="Avbryt" kind="outline" height={52} size={15} style={{ flex: 1 }} onPress={onClose} />
        <Btn label={busy ? 'Lagrer …' : 'Lagre'} height={52} size={15} style={{ flex: 1 }} onPress={save} />
      </View>
    </Sheet>
  );
}
