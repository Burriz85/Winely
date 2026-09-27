import { C, typeColor, type Wine } from '@vinskap/shared';
import { Image } from 'expo-image';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { em, figtree, syne, t } from '../lib/theme';

export function Chip({ label, active, onPress, pad = 14 }: { label: string; active: boolean; onPress: () => void; pad?: number }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexShrink: 0, height: 34, paddingHorizontal: pad, borderRadius: 17, justifyContent: 'center',
        borderWidth: 1, borderColor: active ? C.sageDark : C.sageLight, backgroundColor: active ? C.sageDark : 'transparent',
      }}
    >
      <Text style={{ ...figtree(500), fontSize: 13, color: active ? C.ivory : C.coal }}>{label}</Text>
    </Pressable>
  );
}

type BtnKind = 'primary' | 'outline' | 'sage' | 'disabled';
export function Btn({ label, onPress, kind = 'primary', height = 44, size = 14, style, pad = 16 }: {
  label: string; onPress?: () => void; kind?: BtnKind; height?: number; size?: number; style?: StyleProp<ViewStyle>; pad?: number;
}) {
  const box: ViewStyle =
    kind === 'primary' ? { backgroundColor: C.sageDark }
    : kind === 'outline' ? { borderWidth: 1, borderColor: C.coal }
    : kind === 'sage' ? { borderWidth: 1, borderColor: C.sage }
    : { borderWidth: 1, borderColor: C.ivoryDark, backgroundColor: C.ivoryDark };
  const color = kind === 'primary' ? C.ivory : kind === 'sage' ? C.sageDark : kind === 'disabled' ? C.coalSoft : C.coal;
  return (
    <Pressable
      onPress={kind === 'disabled' ? undefined : onPress}
      disabled={kind === 'disabled'}
      accessibilityRole="button"
      style={[{ height, paddingHorizontal: pad, borderRadius: 4, alignItems: 'center', justifyContent: 'center' }, box, style]}
    >
      <Text style={{ ...figtree(600), fontSize: size, color }}>{label}</Text>
    </Pressable>
  );
}

export function LinkBtn({ label, onPress, color = C.sageDark, size = 14, style }: {
  label: string; onPress: () => void; color?: string; size?: number; style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable onPress={onPress} style={[{ minHeight: 36, justifyContent: 'center' }, style]} accessibilityRole="button">
      <Text style={{ ...figtree(600), fontSize: size, color }}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, height = 44, size = 15, style, ...rest }: TextInputProps & { label?: string; height?: number; size?: number }) {
  const input = (
    <TextInput
      placeholderTextColor={C.coalSoft + '99'}
      {...rest}
      style={[{
        height, paddingHorizontal: 14, borderWidth: 1, borderColor: C.sageLight, borderRadius: 4, backgroundColor: C.white,
        fontSize: size, color: C.coal, ...figtree(400),
      }, style as TextStyle]}
    />
  );
  if (!label) return input;
  return (
    <View style={{ gap: 6 }}>
      <Text style={t.label}>{label}</Text>
      {input}
    </View>
  );
}

export const Handle = () => (
  <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: C.sageLight }} />
);

export const Dot = ({ on, size = 8 }: { on: boolean; size?: number }) => (
  <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: on ? C.sageDark : C.honeyText }} />
);

/** Flaskebilde fra Vinmonopolet med typefarget stripe. 404 → bare stripen. */
export function WineThumb({ wine, w = 40, h = 60, stripe = true, radius = 4 }: { wine: Pick<Wine, 'img' | 'type'>; w?: number; h?: number; stripe?: boolean; radius?: number }) {
  const [failed, setFailed] = useState(false);
  const color = typeColor(wine.type);
  if (!wine.img || failed) {
    return <View style={{ width: 6, alignSelf: 'stretch', minHeight: 48, borderRadius: 2, backgroundColor: color, flexShrink: 0 }} />;
  }
  return (
    <View style={{ width: w, height: h, flexShrink: 0, borderRadius: radius, backgroundColor: C.white, overflow: 'hidden' }}>
      <Image source={{ uri: wine.img }} style={{ width: '100%', height: '100%' }} contentFit="contain" onError={() => setFailed(true)} />
      {stripe && <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: color }} />}
    </View>
  );
}

/** Rå bilde uten reserve (brukes der prototypen skjuler bildet helt når det mangler). */
export function Bottle({ uri, w, h }: { uri: string; w: number | `${number}%`; h: number | `${number}%` }) {
  const [failed, setFailed] = useState(false);
  if (!uri || failed) return null;
  return <Image source={{ uri }} style={{ width: w, height: h }} contentFit="contain" onError={() => setFailed(true)} />;
}

/** Detaljvisningens flaske i hvitt kort som overlapper toppen. Uten bilde vises ingenting. */
export function HeroBottle({ uri }: { uri: string }) {
  const [failed, setFailed] = useState(false);
  if (!uri || failed) return null;
  return (
    <View style={{ alignSelf: 'center', marginTop: -68, padding: 12, backgroundColor: C.white, borderRadius: 4 }}>
      <Image source={{ uri }} style={{ width: 120, height: 180 }} contentFit="contain" onError={() => setFailed(true)} />
    </View>
  );
}

export function Row({ k, v, last }: { k: string; v: ReactNode; last?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: last ? 0 : 1, borderBottomColor: C.ivoryDark, gap: 12 }}>
      <Text style={{ ...figtree(400), fontSize: 14, color: C.coalSoft }}>{k}</Text>
      <Text style={{ ...figtree(500), fontSize: 14, color: C.coal, flexShrink: 1, textAlign: 'right' }}>{v || '—'}</Text>
    </View>
  );
}

export const Qty = ({ n }: { n: number }) => (
  <View style={{ alignItems: 'flex-end' }}>
    <Text style={{ ...syne(700), fontSize: 22, lineHeight: 22, color: C.coal }}>{n}</Text>
    <Text style={{ ...figtree(400), fontSize: 10, letterSpacing: em(10, 0.18), textTransform: 'uppercase', color: C.coalSoft }}>fl.</Text>
  </View>
);

export function NumField({ value, onChange, placeholder, width = 96 }: { value: number | null; onChange: (n: number | null) => void; placeholder: string; width?: number }) {
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
