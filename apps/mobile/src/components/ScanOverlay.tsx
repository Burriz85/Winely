import { useNetInfo } from '@react-native-community/netinfo';
import { C, defaultWindow, WINE_TYPES, type Wine } from '@vinskap/shared';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { productToWine, useCellar, useWines } from '../lib/data';
import { queue, uuid } from '../lib/queue';
import { supabase } from '../lib/supabase';
import { figtree, syne, t } from '../lib/theme';
import { useUI, type Scan } from '../lib/ui';
import { sub } from '../lib/wine';
import { Btn, Chip, Field, Handle, LinkBtn, WineThumb } from './ui';

/** UPC-A (12 siffer) rapporteres som EAN-13 med innledende 0 på iOS. Samme nøkkel på alle enheter. */
const normalizeEan = (s: string) => {
  const d = s.replace(/\D/g, '');
  return d.length === 12 ? '0' + d : d;
};

function ScanLine({ height }: { height: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      Animated.timing(v, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
    ]));
    a.start();
    return () => a.stop();
  }, [v]);
  // @keyframes scanline { 0% {top:20%} 50% {top:76%} 100% {top:20%} }, 1,6 s
  const top = v.interpolate({ inputRange: [0, 1], outputRange: [height * 0.2, height * 0.76] });
  return (
    <Animated.View style={{
      position: 'absolute', left: 10, right: 10, height: 2, top, backgroundColor: C.honeyText,
      ...(Platform.OS === 'web' ? ({ boxShadow: '0 0 12px #A87C28' } as object) : { shadowColor: C.honeyText, shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } }),
    }} />
  );
}

export function ScanOverlay() {
  const { scan, setScan, setSearch, flash } = useUI();
  const { cellar } = useCellar();
  const { wines } = useWines(cellar?.id);
  const insets = useSafeAreaInsets();
  const [perm, requestPerm] = useCameraPermissions();
  const [areaH, setAreaH] = useState(0);
  const lock = useRef(false);

  const camActive = scan?.phase === 'cam' || scan?.phase === 'lookup';
  useEffect(() => {
    if (camActive && perm && !perm.granted && perm.canAskAgain) requestPerm();
  }, [camActive, perm, requestPerm]);
  useEffect(() => {
    if (scan?.phase === 'cam') lock.current = false;
  }, [scan?.phase]);

  if (!scan) return null;

  const onScanned = async (r: BarcodeScanningResult) => {
    const ean = normalizeEan(r.data);
    if (lock.current || !/^\d{8,14}$/.test(ean)) return;
    lock.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setScan({ phase: 'lookup', ean });
    const { data, error } = await supabase.rpc('lookup_ean', { p_ean: ean });
    if (error) {
      flash('Kunne ikke slå opp strekkoden. Sjekk nettet.');
      setScan({ phase: 'cam' });
      return;
    }
    const p = (data as any[])?.[0];
    if (p) {
      const have = wines.find((w) => w.nr === p.vmp_nr);
      const wine = have ?? productToWine(p);
      setScan({ phase: 'res', wine: { ...wine, type: wine.type ?? 'Rødvin' }, isNew: !have, qty: 1, scanned: ean });
    } else {
      // Ukjent strekkode → «Hvilken vin er dette?»
      setScan(null);
      setSearch({ ean });
    }
  };

  const frameTop = areaH * 0.44 - 80;

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, backgroundColor: C.scanBg }}>
      <View style={{ flex: 1, overflow: 'hidden', backgroundColor: C.coal }} onLayout={(e) => setAreaH(e.nativeEvent.layout.height)}>
        {camActive && perm?.granted && (
          <CameraView
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a'] }}
            // Skanneren står på pause mens arket er åpent eller et oppslag pågår.
            onBarcodeScanned={scan.phase === 'cam' ? onScanned : undefined}
          />
        )}
        <Pressable onPress={() => setScan(null)} accessibilityLabel="Lukk"
          style={{ position: 'absolute', top: insets.top + 4, right: 16, zIndex: 2, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(250,250,245,0.15)', alignItems: 'center', justifyContent: 'center' }}>
          <X size={18} color={C.ivory} strokeWidth={1.8} />
        </Pressable>
        {areaH > 0 && (
          <>
            <View style={{ position: 'absolute', left: '50%', marginLeft: -130, top: frameTop, width: 260, height: 160, borderWidth: 2, borderColor: C.sageLight, borderRadius: 8 }}>
              {scan.phase === 'cam' && <ScanLine height={156} />}
            </View>
            <View style={{ position: 'absolute', left: 0, right: 0, top: areaH * 0.44 + 104, alignItems: 'center', gap: 18, paddingHorizontal: 20 }}>
              <Text style={{ ...figtree(400), fontSize: 14, color: C.ivory, textAlign: 'center' }}>
                {scan.phase === 'lookup' ? 'Slår opp strekkoden …'
                  : camActive && perm && !perm.granted ? 'Vinskap trenger tilgang til kameraet for å skanne.'
                  : 'Hold strekkoden innenfor rammen'}
              </Text>
              {camActive && perm && !perm.granted && (
                <Pressable onPress={() => requestPerm()} style={{ height: 44, paddingHorizontal: 18, borderRadius: 22, borderWidth: 1, borderColor: C.sageLight, justifyContent: 'center' }}>
                  <Text style={{ ...figtree(500), fontSize: 14, color: C.ivory }}>Gi tilgang til kameraet</Text>
                </Pressable>
              )}
              <Pressable onPress={() => { setScan(null); setSearch({}); }}
                style={{ height: 44, paddingHorizontal: 18, borderRadius: 22, borderWidth: 1, borderColor: C.sageLight, justifyContent: 'center' }}>
                <Text style={{ ...figtree(500), fontSize: 14, color: C.ivory }}>Søk i Vinmonopolet i stedet</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
      {scan.phase === 'res' && <ResultSheet scan={scan} />}
    </View>
  );
}

function NumField({ value, onChange, placeholder, width = 96 }: { value: number | null; onChange: (n: number | null) => void; placeholder: string; width?: number }) {
  const [text, setText] = useState(value ? String(value) : '');
  useEffect(() => { setText(value ? String(value) : ''); }, [value]);
  return (
    <Field
      value={text}
      onChangeText={(s) => { setText(s); const n = parseInt(s.replace(/\D/g, ''), 10); onChange(Number.isFinite(n) ? n : null); }}
      keyboardType="number-pad"
      inputMode="numeric"
      placeholder={placeholder}
      style={{ width, paddingHorizontal: 12, textAlign: 'right' }}
    />
  );
}

function ResultSheet({ scan }: { scan: Extract<Scan, { phase: 'res' }> }) {
  const { setScan, setSearch, flash } = useUI();
  const { cellar } = useCellar();
  const net = useNetInfo();
  const insets = useSafeAreaInsets();
  const w = scan.wine;
  const now = new Date().getFullYear();

  const patch = (p: Partial<Wine>) => setScan((s) => (s && s.phase === 'res' ? { ...s, wine: { ...s.wine, ...p } } : s));
  const setQty = (d: number) => setScan((s) => (s && s.phase === 'res' ? { ...s, qty: Math.max(1, Math.min(24, s.qty + d)) } : s));

  const commit = (dir: 'in' | 'out') => {
    if (!cellar) return;
    if (dir === 'out' && scan.qty > w.qty) {
      flash('Du har bare ' + w.qty + ' i skapet');
      return;
    }
    queue.add({
      client_id: uuid(), cellar_id: cellar.id, dir, qty: scan.qty, at: new Date().toISOString(),
      wine: w, isNew: scan.isNew, ean: scan.ean,
    });
    setScan(null);
    flash((dir === 'in' ? 'Satt inn ' : 'Tatt ut ') + scan.qty + ' × ' + w.name + (net.isConnected === false ? ' · lagres når du er på nett' : ''));
  };

  const label14 = { ...figtree(500), fontSize: 14, color: C.coal };
  const rowStyle = { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: 12 };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '92%' }}>
      <ScrollView
        style={{ backgroundColor: C.ivory, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
        contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 12) + 22, gap: 18 }}
        keyboardShouldPersistTaps="handled"
      >
        <Handle />
        <View style={rowStyle}>
          <Text style={[t.label, { color: C.sageDark }]}>Funnet på Vinmonopolet</Text>
          {scan.isNew
            ? <Text style={{ ...figtree(600), fontSize: 12, color: C.coalSoft }}>Ny i skapet</Text>
            : <Text style={{ ...figtree(600), fontSize: 12, color: C.honeyText }}>{w.qty} i skapet</Text>}
        </View>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'stretch' }}>
          <WineThumb wine={w} w={56} h={84} />
          <View style={{ gap: 3, minWidth: 0, flex: 1 }}>
            <Text style={{ ...syne(700), fontSize: 22, lineHeight: 24, color: C.coal }}>{w.name}</Text>
            <Text style={{ ...figtree(400), fontSize: 14, color: C.coalSoft }}>{sub(w)}</Text>
            <Text style={{ ...figtree(400), fontSize: 13, color: C.coalSoft }}>Varenr. {w.nr}</Text>
          </View>
        </View>
        {scan.isNew && (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {WINE_TYPES.map((ty) => <Chip key={ty} label={ty} pad={12} active={w.type === ty} onPress={() => patch({ type: ty })} />)}
            </View>
            <View style={rowStyle}>
              <Text style={label14}>Årgang</Text>
              <NumField value={w.year} placeholder="NV" onChange={(y) => {
                const year = y && y > 1900 && y <= now + 1 ? y : null;
                patch({ year, ...defaultWindow(year, now) });
              }} />
            </View>
            <View style={rowStyle}>
              <Text style={label14}>Pris per flaske</Text>
              <NumField value={w.price || null} placeholder="kr" onChange={(p) => patch({ price: p ?? 0 })} />
            </View>
            <View style={rowStyle}>
              <Text style={label14}>Drikkevindu</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <NumField width={72} value={w.from} placeholder="Fra" onChange={(n) => n && patch({ from: n })} />
                <Text style={label14}>–</Text>
                <NumField width={72} value={w.to} placeholder="Til" onChange={(n) => n && patch({ to: n })} />
              </View>
            </View>
          </View>
        )}
        <View style={[rowStyle, { paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.ivoryDark }]}>
          <Text style={label14}>Antall flasker</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Pressable onPress={() => setQty(-1)} accessibilityLabel="Færre"
              style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: C.sageLight, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 20, color: C.coal }}>−</Text>
            </Pressable>
            <Text style={{ minWidth: 36, textAlign: 'center', ...syne(700), fontSize: 22, color: C.coal }}>{scan.qty}</Text>
            <Pressable onPress={() => setQty(1)} accessibilityLabel="Flere"
              style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: C.sageLight, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 20, color: C.coal }}>+</Text>
            </Pressable>
          </View>
        </View>
        <Text style={{ ...figtree(500), fontSize: 15, color: C.coal }}>Hva vil du gjøre?</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Btn label="Ta ut" kind={scan.isNew ? 'disabled' : 'outline'} height={56} size={15} style={{ flex: 1 }} onPress={() => commit('out')} />
          <Btn label="Sett inn" height={56} size={15} style={{ flex: 1 }} onPress={() => {
            if (scan.isNew && !w.type) return flash('Velg type');
            commit('in');
          }} />
        </View>
        <LinkBtn label="Feil vin? Søk i Vinmonopolet" size={13} style={{ alignSelf: 'center' }}
          onPress={() => { const ean = scan.ean ?? scan.scanned; setScan(null); setSearch({ ean }); }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
