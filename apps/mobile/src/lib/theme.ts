import { StyleSheet, type TextStyle } from 'react-native';
import { C } from '@vinskap/shared';

export { C };

// Egendefinerte fonter i React Native velger ikke vekt selv, så hver vekt er en egen familie.
export const syne = (w: 600 | 700 | 800): TextStyle => ({
  fontFamily: w === 600 ? 'Syne_600SemiBold' : w === 700 ? 'Syne_700Bold' : 'Syne_800ExtraBold',
});
export const figtree = (w: 400 | 500 | 600 = 400): TextStyle => ({
  fontFamily: w === 400 ? 'Figtree_400Regular' : w === 500 ? 'Figtree_500Medium' : 'Figtree_600SemiBold',
});

/** em → px for letterSpacing */
export const em = (size: number, e: number) => size * e;

export const t = StyleSheet.create({
  // 11 px, 500, 0.22em, store bokstaver
  label: { ...figtree(500), fontSize: 11, letterSpacing: em(11, 0.22), textTransform: 'uppercase', color: C.coalSoft },
  labelSmall: { ...figtree(500), fontSize: 10, letterSpacing: em(10, 0.22), textTransform: 'uppercase', color: C.coalSoft },
  hero: { ...syne(800), fontSize: 44, lineHeight: 44, letterSpacing: em(44, -0.04), textTransform: 'uppercase', color: C.coal },
  body: { ...figtree(400), fontSize: 15, color: C.coal },
  sub: { ...figtree(400), fontSize: 13, color: C.coalSoft },
  name16: { ...syne(600), fontSize: 16, lineHeight: 19, color: C.coal },
  // Seksjonstittel med sage-linje under
  section: {
    ...figtree(500), fontSize: 11, letterSpacing: em(11, 0.22), textTransform: 'uppercase', color: C.sageDark,
    paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: C.sage,
  },
});
