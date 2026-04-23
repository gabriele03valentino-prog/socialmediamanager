import { z } from "zod";
import { anthropic, BRAND_MODEL } from "./claude";
import { BRAND_SYSTEM_BLOCKS } from "./prompts";

export const StageNameInputSchema = z.object({
  genre: z.string().min(1),
  city: z.string().optional(),
  keywords: z.array(z.string()).max(20),
  initials: z.string().max(5).optional(),
  language: z.enum(["italiano", "inglese", "misto", "onomatopeico"]),
  count: z.number().int().min(5).max(20).default(12),
});
export type StageNameInput = z.infer<typeof StageNameInputSchema>;

export const StageNameProposalSchema = z.object({
  name: z.string().min(1).max(40),
  rationale: z.string().min(10).max(400),
});
export type StageNameProposal = z.infer<typeof StageNameProposalSchema>;

const ProposalsSchema = z.object({
  proposals: z.array(StageNameProposalSchema),
});

const TOOL = {
  name: "propose_stage_names",
  description:
    "Proponi un set di nomi d'arte adatti al profilo dell'artista. Per ciascuno spiega perché funziona (sound, memorabilità, distintività).",
  input_schema: {
    type: "object",
    required: ["proposals"],
    properties: {
      proposals: {
        type: "array",
        minItems: 5,
        maxItems: 20,
        items: {
          type: "object",
          required: ["name", "rationale"],
          properties: {
            name: {
              type: "string",
              minLength: 1,
              maxLength: 40,
              description:
                "Nome d'arte puro, SENZA @, SENZA hashtag, SENZA punteggiatura speciale. Deve essere un handle realistico per un artista.",
            },
            rationale: {
              type: "string",
              minLength: 10,
              maxLength: 400,
              description:
                "Perché questo nome funziona: sound, memorabilità, coerenza col genere, origine, distintività rispetto ai concorrenti.",
            },
          },
        },
      },
    },
  },
} as const;

export async function proposeStageNames(
  input: StageNameInput,
): Promise<StageNameProposal[]> {
  const userMessage = `Proponi ${input.count} nomi d'arte per un artista italiano con questi parametri:

\`\`\`json
${JSON.stringify(input, null, 2)}
\`\`\`

Vincoli:
- Nomi di 1-3 parole, lunghezza totale <= 20 caratteri idealmente
- Devono essere realistici come username social (nessuno spazio, pochi simboli)
- Evita nomi già occupati da artisti italiani famosi (Sfera, Marra, Ghali, Lazza, Tananai, ecc.)
- Mix di: (a) nomi che giocano con il sound ed evocano il genere, (b) nomi con origine personale (iniziali, città, soprannomi), (c) nomi simbolici/metaforici${
    input.initials
      ? `\n- Mantieni le iniziali "${input.initials}" in almeno la metà delle proposte`
      : ""
  }`;

  const response = await anthropic().messages.create({
    model: BRAND_MODEL,
    max_tokens: 2048,
    system: BRAND_SYSTEM_BLOCKS,
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find(
    (b): b is Extract<typeof b, { type: "tool_use" }> => b.type === "tool_use",
  );
  if (!toolUse) throw new Error("Claude non ha chiamato il tool propose_stage_names");
  const parsed = ProposalsSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new Error(`Output non valido: ${parsed.error.message}`);
  }
  return parsed.data.proposals;
}
