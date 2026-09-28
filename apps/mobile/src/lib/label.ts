// Etikettlesing (webappen): ta bilde, skaler ned, send til edge-funksjonen «label».
import { isWineType, type WineType } from '@vinskap/shared';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export type Label = {
  name: string; producer: string; vintage: number | null; type: WineType | null;
  country: string; region: string; grapes: string[]; search_query: string;
};

export const canReadLabel = Platform.OS === 'web' && typeof document !== 'undefined';

/** Åpner kameraet (eller bildevelgeren) og gir et nedskalert JPEG-bilde som base64, eller null. */
export function pickLabelPhoto(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'environment');
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        resolve(await downscale(file, 1280));
      } catch {
        resolve(null);
      }
    };
    input.click();
  });
}

async function downscale(file: File, max: number): Promise<string> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82).split(',')[1];
}

export async function readLabel(image: string): Promise<Label> {
  const { data, error } = await supabase.functions.invoke('label', { body: { image, media_type: 'image/jpeg' } });
  if (error || !data?.ok) {
    const ctx = (error as { context?: Response } | null)?.context;
    const j = ctx ? await ctx.json().catch(() => null) : data;
    throw new Error(j?.error || 'Kunne ikke lese etiketten.');
  }
  const l = data.label;
  return {
    name: l.name || '', producer: l.producer || '', vintage: l.vintage > 1900 ? l.vintage : null,
    type: isWineType(l.type) ? l.type : null, country: l.country || '', region: l.region || '',
    grapes: Array.isArray(l.grapes) ? l.grapes.filter(Boolean) : [], search_query: l.search_query || '',
  };
}
