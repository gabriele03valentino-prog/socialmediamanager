import type { CreatorKind } from "@prisma/client";
import { z } from "zod";
import { getKindLabels, KIND_DISPLAY } from "@/lib/kind-labels";
import { anthropic, BRAND_MODEL } from "./claude";
import { BRAND_SYSTEM_BLOCKS } from "./prompts";

/**
 * Project shape consumed dal modulo brand/stage-name (M16).
 * Sostituisce il vecchio lookup ArtistProfile via userId.
 */
export interface StageNameProject {
  id: string;
  kind: CreatorKind;
  displayName: string;
  niche: string | null;
  city: string | null;
  bio: string | null;
}

export const StageNameInputSchema = z.object({
  keywords: z.array(z.string()).max(20),
  initials: z.string().max(5).optional(),
  language: z.enum(["italiano", "inglese", "misto", "onomatopeico"]),
  count: z.number().int().min(5).max(20).default(12),
});
export type StageNameInputBody = z.infer<typeof StageNameInputSchema>;

export interface StageNameInput extends StageNameInputBody {
  project: StageNameProject;
}

export const StageNameProposalSchema = z.object({
  name: z.string().min(1).max(40),
  rationale: z.string().min(10).max(400),
});
export type StageNameProposal = z.infer<typeof StageNameProposalSchema>;

const ProposalsSchema = z.object({
  proposals: z.array(StageNameProposalSchema),
});

/**
 * Etichetta UX per "il nome che il creator userà come identità pubblica".
 * Cambia per kind: per ARTIST è "nome d'arte", per YOUTUBER è "nome canale/handle", ecc.
 */
function nameLabelFor(kind: CreatorKind): string {
  switch (kind) {
    case "ARTIST":
      return "nome d'arte";
    case "YOUTUBER":
      return "nome canale / handle YouTube";
    case "PODCASTER":
      return "stage name / brand handle";
    case "INFLUENCER":
      return "stage name / brand handle";
    case "DIVULGATORE":
      return "nome divulgatore / handle";
    case "BRAND":
      return "brand name";
    default:
      return "nome creator";
  }
}

const TOOL = {
  name: "propose_stage_names",
  description:
    "Proponi un set di nomi adatti al profilo del creator (kind-aware). Per ciascuno spiega perché funziona (sound, memorabilità, distintività).",
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
                "Nome puro, SENZA @, SENZA hashtag, SENZA punteggiatura speciale. Deve essere un handle realistico per un creator.",
            },
            rationale: {
              type: "string",
              minLength: 10,
              maxLength: 400,
              description:
                "Perché questo nome funziona: sound, memorabilità, coerenza con la nicchia, origine, distintività rispetto ai concorrenti.",
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
  const { project } = input;
  const labels = getKindLabels(project.kind);
  const kindDisplay = KIND_DISPLAY[project.kind];
  const nameLabel = nameLabelFor(project.kind);
  const niche = project.niche?.trim() || "non specificata";

  const promptPayload = {
    kind: project.kind,
    kindLabel: labels.creator,
    kindDisplay,
    nameLabel,
    creator: {
      displayName: project.displayName,
      niche: project.niche,
      city: project.city,
      bio: project.bio,
    },
    keywords: input.keywords,
    initials: input.initials,
    language: input.language,
    count: input.count,
  };

  const userMessage = `Proponi ${input.count} ${nameLabel} per un ${labels.creator} italiano (${kindDisplay}, nicchia ${niche}) con questi parametri:

\`\`\`json
${JSON.stringify(promptPayload, null, 2)}
\`\`\`

Vincoli:
- Nomi di 1-3 parole, lunghezza totale <= 20 caratteri idealmente
- Devono essere realistici come username social (nessuno spazio, pochi simboli)
- Evita nomi già occupati da nomi famosi italiani (Sfera, Marra, Ghali, Lazza, Tananai per ARTIST; analoghi top creator per altri kind)
- Mix di: (a) nomi che giocano con il sound ed evocano la nicchia, (b) nomi con origine personale (iniziali, città, soprannomi), (c) nomi simbolici/metaforici${
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
