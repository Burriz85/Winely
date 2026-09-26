// Designtokens fra handoff-README. Samme verdier i mobil og admin.
export const C = {
  ivory: '#FAFAF5',
  ivoryDark: '#F0EFE8',
  sage: '#6B8C6A',
  sageDark: '#4E6B4D',
  sageLight: '#B8CEB7',
  sageTint: '#E4ECE3',
  honey: '#C8993A',
  honeyText: '#A87C28',
  honeyTint: '#F4EBD6',
  coal: '#2A2520',
  coalSoft: '#4A403A',
  red: '#A04040',
  redTint: '#F3E2E0',
  white: '#FFFFFF',
  scanBg: '#1A1714',
} as const;

export const WINE_TYPES = ['Rødvin', 'Hvitvin', 'Musserende', 'Rosévin'] as const;
export type WineType = (typeof WINE_TYPES)[number];

export const TYPE_COLOR: Record<WineType, string> = {
  Rødvin: '#7A3A3A',
  Hvitvin: '#C9B878',
  Musserende: '#B8CEB7',
  Rosévin: '#D49A8F',
};

/** Fallback når typen mangler (samme som prototypen). */
export const typeColor = (t?: string | null) => (t && (TYPE_COLOR as Record<string, string>)[t]) || C.honeyText;

export const isWineType = (t: unknown): t is WineType => (WINE_TYPES as readonly unknown[]).includes(t);
