import { z } from "zod";
import { anthropic, BRAND_MODEL } from "./claude";
import { BRAND_SYSTEM_BLOCKS } from "./prompts";

export const CoverInputSchema = z.object({
  releaseTitle: z.string().min(1),
  releaseType: z.enum(["singolo", "ep", "album"]),
  mood: z.string().min(1),
  story: z.string().min(5).max(1000),
  keywords: z.array(z.string()).min(1).max(6),
  // Identità dell'artista (presa da BrandIdentity se presente)
  palette: z.array(z.string()).max(6).optional(), // hex values
  moodKeywordsBrand: z.array(z.string()).max(10).optional(),
});
export type CoverInput = z.infer<typeof CoverInputSchema>;

export const CoverBriefSchema = z.object({
  title: z.string(),
  brief: z.string().min(50).max(2000),
  claudeDesignPrompt: z.string().min(30).max(2000),
  mjPrompt: z.string().min(30).max(1500),
  ideogramPrompt: z.string().min(30).max(1500),
});
export type CoverBriefOutput = z.infer<typeof CoverBriefSchema>;

const TOOL = {
  name: "generate_cover_brief",
  description:
    "Genera brief per la copertina di una release musicale, coerente con la brand identity dell'artista.",
  input_schema: {
    type: "object",
    required: [
      "title",
      "brief",
      "claudeDesignPrompt",
      "mjPrompt",
      "ideogramPrompt",
    ],
    properties: {
      title: {
        type: "string",
        description: "Titolo della release, ecoato per riferimento",
      },
      brief: {
        type: "string",
        description:
          "Descrizione completa del concept visivo: soggetto, composizione, illuminazione, colori dominanti, texture, mood emotivo. Italiano.",
      },
      claudeDesignPrompt: {
        type: "string",
        description:
          "Prompt copia-incollabile in claude.ai/design per generare la cover, 1:1 formato album. Include palette hex e riferimenti visivi.",
      },
      mjPrompt: {
        type: "string",
        description:
          "Prompt Midjourney ottimizzato (soggetto, medium, dettagli, lighting, camera, --ar 1:1 --style raw --v 6)",
      },
      ideogramPrompt: {
        type: "string",
        description:
          "Prompt per Ideogram (particolarmente bravo con testo sulla cover, utile se il titolo è parte del design).",
      },
    },
  },
} as const;

export async function generateCoverBrief(
  input: CoverInput,
): Promise<CoverBriefOutput> {
  const userMessage = `Genera il brief per la copertina di questa release:

\`\`\`json
${JSON.stringify(input, null, 2)}
\`\`\`

La copertina deve:
- Essere memorabile al primo scroll su Spotify/Apple Music (thumb 120x120 leggibile)
- Raccontare in un colpo d'occhio il mood del brano
- Essere coerente con la brand identity (palette + moodKeywordsBrand se forniti)
- Evitare cliché del genere (es. foto dell'artista in primo piano per trap = visto mille volte)
- Ogni prompt (Claude/Midjourney/Ideogram) deve essere ottimizzato per quel tool specifico.`;

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
  if (!toolUse) throw new Error("Claude non ha chiamato il tool generate_cover_brief");
  const parsed = CoverBriefSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new Error(`Output non valido: ${parsed.error.message}`);
  }
  return parsed.data;
}
