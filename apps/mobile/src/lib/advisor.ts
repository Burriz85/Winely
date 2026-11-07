// Vinrådgiveren: spør edge-funksjonen «advisor» hvilke viner i skapet som passer til noe.
import { supabase } from './supabase';

export type AdvisorPick = { product_id: string; vmp_nr: string | null; reason: string };
export type AdvisorAnswer = { summary: string; picks: AdvisorPick[] };

export const MAX_QUESTION = 300;

export async function askAdvisor(cellarId: string, question: string): Promise<AdvisorAnswer> {
  const { data, error } = await supabase.functions.invoke('advisor', { body: { cellar_id: cellarId, question } });
  if (error || !data?.ok) {
    // Ved feilstatus ligger svaret fra funksjonen i error.context.
    const ctx = (error as { context?: Response } | null)?.context;
    const j = ctx ? await ctx.json().catch(() => null) : data;
    throw new Error(j?.error || 'Vinrådgiveren svarte ikke. Sjekk nettet og prøv igjen.');
  }
  return { summary: data.summary ?? '', picks: Array.isArray(data.picks) ? data.picks : [] };
}
