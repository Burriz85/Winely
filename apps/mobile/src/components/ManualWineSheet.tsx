import { C, defaultWindow, type Wine } from '@vinskap/shared';
import { useState } from 'react';
import { Text } from 'react-native';
import { uuid } from '../lib/queue';
import { figtree, syne } from '../lib/theme';
import { useUI } from '../lib/ui';
import { Sheet } from './Sheet';
import { Btn, Field } from './ui';

/**
 * Vin som ikke finnes hos Vinmonopolet (utenlandsk, taxfree, gave …).
 * Her fylles navn og opprinnelse inn; type, årgang, pris, drikkevindu og antall kommer i arket etterpå.
 */
export function ManualWineSheet() {
  const { manual, setManual, setScan, flash } = useUI();
  const [name, setName] = useState('');
  const [producer, setProducer] = useState('');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [started, setStarted] = useState<typeof manual>(null);
  if (!manual) return null;
  if (started !== manual) {
    setStarted(manual);
    setName(manual.name ?? ''); setProducer(''); setCountry(''); setRegion('');
  }

  const next = () => {
    if (!name.trim()) return flash('Skriv inn navnet på vinen');
    const w = defaultWindow(null);
    const wine: Wine = {
      productId: uuid(), nr: '', name: name.trim(), producer: producer.trim(), year: null, type: null,
      country: country.trim(), region: region.trim(), grape: '', abv: '', price: 0, taste: '', food: '',
      qty: 0, from: w.from, to: w.to, img: '',
    };
    setManual(null);
    setScan({ phase: 'res', wine, isNew: true, qty: 1, ean: manual.ean });
  };

  return (
    <Sheet onClose={() => setManual(null)} gap={14}>
      <Text style={{ ...syne(700), fontSize: 22, textTransform: 'uppercase', color: C.coal }}>Legg inn vin</Text>
      <Text style={{ ...figtree(400), fontSize: 13, lineHeight: 19, color: C.coalSoft }}>
        For vin som ikke finnes hos Vinmonopolet.{manual.ean ? ' Strekkoden ' + manual.ean + ' kobles til vinen, så den kjennes igjen neste gang.' : ''}
      </Text>
      <Field label="Navn" value={name} onChangeText={setName} placeholder="F.eks. Château Musar 2016" autoFocus />
      <Field label="Produsent" value={producer} onChangeText={setProducer} />
      <Field label="Land" value={country} onChangeText={setCountry} />
      <Field label="Distrikt" value={region} onChangeText={setRegion} />
      <Btn label="Neste" height={52} size={15} onPress={next} style={{ marginTop: 4 }} />
    </Sheet>
  );
}
