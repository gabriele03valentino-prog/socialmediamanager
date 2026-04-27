// Schema condivisi per il modulo Marketing.
// Usati sia lato server (validazione output Claude) sia lato client/server
// quando leggiamo i campi Json da Prisma e abbiamo bisogno di type-safety.

import { z } from "zod";

export const NeuroBreakdownSchema = z.object({
  hookStrength: z.number().int().min(0).max(20),
  emotionalValence: z.number().int().min(0).max(20),
  noveltyBias: z.number().int().min(0).max(20),
  rewardPrediction: z.number().int().min(0).max(20),
  socialSalience: z.number().int().min(0).max(20),
  curiosityGap: z.number().int().min(0).max(20),
});

export type NeuroBreakdown = z.infer<typeof NeuroBreakdownSchema>;

export const NeuroImprovementsSchema = z.array(z.string().min(1)).min(1).max(6);

export interface NeuroScoreData {
  score: number;
  breakdown: NeuroBreakdown;
  improvements: string[];
}

const ZERO_BREAKDOWN: NeuroBreakdown = {
  hookStrength: 0,
  emotionalValence: 0,
  noveltyBias: 0,
  rewardPrediction: 0,
  socialSalience: 0,
  curiosityGap: 0,
};

/**
 * Converte un campo Prisma Json (proveniente da NeuroScore.breakdown) in
 * un oggetto type-safe. In caso di JSON malformato (es. snapshot vecchi)
 * restituisce uno zero-breakdown invece di lanciare, così la UI non rompe.
 */
export function parseNeuroBreakdown(raw: unknown): NeuroBreakdown {
  const parsed = NeuroBreakdownSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return ZERO_BREAKDOWN;
}

export function parseNeuroImprovements(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.length > 0);
}
