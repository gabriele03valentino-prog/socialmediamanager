import { z } from "zod";
import { anthropic, MARKETING_MODEL } from "./claude";
import { MARKETING_SYSTEM_BLOCKS } from "./prompts";

export interface NeuroInput {
  platform: string;
  contentType: string;
  hook?: string;
  caption: string;
  hashtags?: string[];
  suggestedTime?: string | null;
  cta?: string | null;
  mediaNotes?: string | null;
  artist?: {
    stageName?: string;
    genre?: string;
    city?: string | null;
  };
}

export const NeuroBreakdownSchema = z.object({
  hookStrength: z.number().int().min(0).max(20), // V1/V4 + STS primo secondo
  emotionalValence: z.number().int().min(0).max(20), // amigdala + insula
  noveltyBias: z.number().int().min(0).max(20), // DA novelty
  rewardPrediction: z.number().int().min(0).max(20), // nucleus accumbens
  socialSalience: z.number().int().min(0).max(20), // corteccia prefrontale mediale
  curiosityGap: z.number().int().min(0).max(20), // completeness/Zeigarnik
});
export type NeuroBreakdown = z.infer<typeof NeuroBreakdownSchema>;

export const NeuroResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  breakdown: NeuroBreakdownSchema,
  improvements: z.array(z.string().min(5).max(400)).min(2).max(5),
  summary: z.string().min(20).max(600),
});
export type NeuroResult = z.infer<typeof NeuroResultSchema>;

const TOOL = {
  name: "score_content_neuro",
  description:
    "Valuta un contenuto social con lenti di neuromarketing (ispirate ai segnali brain-predictive di TRIBE v2) e propone miglioramenti concreti.",
  input_schema: {
    type: "object",
    required: ["score", "breakdown", "improvements", "summary"],
    properties: {
      score: {
        type: "integer",
        minimum: 0,
        maximum: 100,
        description:
          "Score aggregato 0-100. La media ponderata del breakdown (le 6 dimensioni contano 20 pt ciascuna, la soglia totale è 120 → normalizzato a 100).",
      },
      breakdown: {
        type: "object",
        required: [
          "hookStrength",
          "emotionalValence",
          "noveltyBias",
          "rewardPrediction",
          "socialSalience",
          "curiosityGap",
        ],
        properties: {
          hookStrength: {
            type: "integer",
            minimum: 0,
            maximum: 20,
            description:
              "Forza del hook nei primi 1-2 secondi. V1/V4 per contrasto visivo + STS per audio/parola iniziale.",
          },
          emotionalValence: {
            type: "integer",
            minimum: 0,
            maximum: 20,
            description:
              "Carica emotiva attivabile (amigdala + insula). Vulnerabilità, intensità, contrasto tensione/risoluzione.",
          },
          noveltyBias: {
            type: "integer",
            minimum: 0,
            maximum: 20,
            description:
              "Novelty detection (DA prediction error). Quanto il contenuto rompe pattern noti o introduce elementi inediti.",
          },
          rewardPrediction: {
            type: "integer",
            minimum: 0,
            maximum: 20,
            description:
              "Anticipazione ricompensa (nucleus accumbens). Build-up, drop reveal, promessa di payoff.",
          },
          socialSalience: {
            type: "integer",
            minimum: 0,
            maximum: 20,
            description:
              "Rilevanza sociale (corteccia prefrontale mediale). Identità tribale, appartenenza scena/crew/città.",
          },
          curiosityGap: {
            type: "integer",
            minimum: 0,
            maximum: 20,
            description:
              "Gap di completezza (Zeigarnik). Info mancante che spinge a cliccare/riguardare/commentare.",
          },
        },
      },
      improvements: {
        type: "array",
        minItems: 2,
        maxItems: 5,
        items: {
          type: "string",
          description:
            "Un miglioramento concreto e applicabile subito, che risolve la dimensione più debole del breakdown. Massimo 1 frase.",
        },
      },
      summary: {
        type: "string",
        description:
          "Sintesi in 2-3 frasi: cosa funziona, qual è il punto debole, one-shot insight.",
      },
    },
  },
} as const;

export async function scoreContent(input: NeuroInput): Promise<NeuroResult> {
  const userMessage = `Valuta questo contenuto proposto per i social di un artista musicale italiano.

\`\`\`json
${JSON.stringify(input, null, 2)}
\`\`\`

Tieni presente:
- La valutazione è ispirata ai segnali brain-predictive di TRIBE v2 (Meta AI). Non hai accesso al modello reale, ma ragioni nelle sue categorie.
- Non essere generoso: la media attesa per un post "decente" di un emergente è 50-60/100. Solo i contenuti davvero forti superano 75.
- Le suggestions devono essere chirurgiche, non generiche. Se il punto debole è hookStrength ≤ 10, proponi un hook alternativo specifico basato sul testo reale del contenuto.`;

  const response = await anthropic().messages.create({
    model: MARKETING_MODEL,
    max_tokens: 1200,
    system: MARKETING_SYSTEM_BLOCKS,
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find(
    (b): b is Extract<typeof b, { type: "tool_use" }> => b.type === "tool_use",
  );
  if (!toolUse) throw new Error("Claude non ha chiamato il tool score_content_neuro");
  const parsed = NeuroResultSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new Error(`Output non valido: ${parsed.error.message}`);
  }
  return parsed.data;
}
