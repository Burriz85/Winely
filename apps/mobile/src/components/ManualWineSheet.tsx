import { C, defaultWindow, guessYear, type Wine, type WineType } from '@vinskap/shared';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { uploadWineImage } from '../lib/images';
import { canReadLabel, pickLabelPhoto, readLabel } from '../lib/label';
import { uuid } from '../lib/queue';
import { figtree, syne } from '../lib/theme';
import { useUI } from '../lib/ui';
import { vmp } from '../lib/vmp';
import { Sheet } from './Sheet';
import { Btn, Field, LinkBtn } from './ui';

/**
 * Vin som ikke finnes hos Vinmonopolet (utenlandsk, taxfree, gave …).
 * Navn og opprinnelse fylles inn her, for hånd eller fra et bilde av etiketten.
 * Type, årgang, pris, drikkevindu og antall kommer i arket etterpå.
 */
export function ManualWineSheet() {
  const { manual, setManual, setScan, setSearch, flash } = useUI();
  const [name, setName] = useState('');
  const [producer, setProducer] = useState('');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [fromLabel, setFromLabel] = useState<{ type: WineType | null; vintage: number | null; grapes: string[] } | null>(null);
  const [reading, setReading] = useState(false);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [vmpHits, setVmpHits] = useState<{ query: string; n: number } | null>(null);
  const [started, setStarted] = useState<typeof manual>(null);
  if (!manual) return null;
  if (started !== manual) {
    setStarted(manual);
    setName(manual.name ?? ''); setProducer(''); setCountry(''); setRegion('');
    setFromLabel(null); setVmpHits(null); setReading(false); setPhotoData(null); setSaving(false);
  }

  const photo = async () => {
    const image = await pickLabelPhoto();
    if (!image) return;
    setPhotoData(image); // brukes også som bilde av vinen
    setReading(true); setVmpHits(null);
    try {
      const l = await readLabel(image);
      if (!l.name && !l.producer) { flash('Fant ingen etikett i bildet. Prøv igjen, nærmere og uten gjenskinn.'); return; }
      setName(l.name || name); setProducer(l.producer || producer);
      setCountry(l.country || country); setRegion(l.region || region);
      setFromLabel({ type: l.type, vintage: l.vintage, grapes: l.grapes });
      // Kanskje finnes den hos Vinmonopolet likevel, under et annet navn.
      if (l.search_query) {
        const hits = await vmp.search(l.search_query).catch(() => []);
        if (hits.length) setVmpHits({ query: l.search_query, n: hits.length });
      }
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setReading(false);
    }
  };

  const next = async () => {
    if (!name.trim()) return flash('Skriv inn navnet på vinen');
    const productId = uuid();
    let img = '';
    if (photoData) {
      setSaving(true);
      // Uten nett eller ved feil lagres vinen uten bilde; det kan legges til senere på vinsiden.
      img = await uploadWineImage(productId, photoData).catch(() => '');
      setSaving(false);
    }
    const year = fromLabel?.vintage ?? guessYear(name);
    const w = defaultWindow(year);
    const wine: Wine = {
      productId, nr: '', name: name.trim(), producer: producer.trim(), year, type: fromLabel?.type ?? null,
      country: country.trim(), region: region.trim(), grape: (fromLabel?.grapes ?? []).join(', '), abv: '', price: 0,
      taste: '', food: '', qty: 0, from: w.from, to: w.to, img,
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
      {canReadLabel && (
        <Btn label={reading ? 'Leser etiketten …' : 'Ta bilde av etiketten'} kind="sage" height={48} onPress={reading ? undefined : photo} />
      )}
      {vmpHits && (
        <View style={{ padding: 12, borderRadius: 4, backgroundColor: C.honeyTint, gap: 4 }}>
          <Text style={{ ...figtree(500), fontSize: 13, color: C.coal }}>
            Vinmonopolet har {vmpHits.n} treff på «{vmpHits.query}». Finnes vinen der, får du pris, druer og smak automatisk.
          </Text>
          <LinkBtn label="Se treffene" size={13} onPress={() => { setManual(null); setSearch({ ean: manual.ean, prefill: vmpHits.query, autorun: true }); }} />
        </View>
      )}
      <Field label="Navn" value={name} onChangeText={setName} placeholder="F.eks. Château Musar 2016" />
      <Field label="Produsent" value={producer} onChangeText={setProducer} />
      <Field label="Land" value={country} onChangeText={setCountry} />
      <Field label="Distrikt" value={region} onChangeText={setRegion} />
      {fromLabel && (
        <Text style={{ ...figtree(400), fontSize: 12, color: C.coalSoft }}>
          Fra etiketten: {[fromLabel.type, fromLabel.vintage, fromLabel.grapes.join(', ')].filter(Boolean).join(' · ') || '—'}. Sjekk at det stemmer i neste steg.
        </Text>
      )}
      {photoData && <Text style={{ ...figtree(400), fontSize: 12, color: C.coalSoft }}>Bildet av etiketten lagres som bilde av vinen.</Text>}
      <Btn label={saving ? 'Laster opp bildet …' : 'Neste'} height={52} size={15} onPress={saving ? undefined : next} style={{ marginTop: 4 }} />
    </Sheet>
  );
}
