import type { CampaignType, ContentType, CreatorKind, Platform } from "@prisma/client";
import { z } from "zod";
import { getKindLabels, KIND_CAMPAIGN_TYPES, KIND_DISPLAY } from "@/lib/kind-labels";
import { anthropic, MARKETING_MODEL } from "./claude";
import { MARKETING_SYSTEM_BLOCKS } from "./prompts";

/**
 * Project shape consumed dal modulo marketing/campaign (M16).
 * Sostituisce il vecchio lookup ArtistProfile via userId.
 */
export interface CampaignProject {
  id: string;
  kind: CreatorKind;
  displayName: string;
  niche: string | null;
  city: string | null;
  bio: string | null;
}

export interface CampaignInput {
  project: CampaignProject;
  title: string;
  /**
   * Tipo di campagna scelto dall'utente. DEVE essere ∈ availableTypes
   * (a sua volta derivato da KIND_CAMPAIGN_TYPES[project.kind]).
   */
  type: CampaignType;
  /**
   * Sottoinsieme di CampaignType ammessi per il kind del progetto.
   * Se omesso, lo deriviamo da KIND_CAMPAIGN_TYPES[kind].
   */
  availableTypes?: CampaignType[];
  releaseDate: string; // YYYY-MM-DD
  preSaveUrl?: string;
  goal?: string;
  // Se abbiamo persona attive le passiamo così le tappe sono target-aware.
  personas?: Array<{
    name: string;
    triggers: string[];
    platforms: string[];
  }>;
}

const PLATFORMS: readonly Platform[] = [
  "INSTAGRAM",
  "FACEBOOK",
  "TIKTOK",
  "YOUTUBE",
  "SPOTIFY",
];
const CONTENT_TYPES: readonly ContentType[] = [
  "REEL",
  "CAROUSEL",
  "SHORT",
  "POST",
  "STORY",
  "TIKTOK",
  "YT_LONG",
];

const StepSchema = z.object({
  forDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  suggestedTime: z.string().regex(/^\d{2}:\d{2}$/),
  platform: z.enum(PLATFORMS as [Platform, ...Platform[]]),
  contentType: z.enum(CONTENT_TYPES as [ContentType, ...ContentType[]]),
  phase: z.enum(["teaser", "build", "reveal", "drop", "echo", "post_release"]),
  hook: z.string().min(5).max(240),
  caption: z.string().min(10).max(2200),
  hashtags: z.array(z.string()).max(10),
  cta: z.string().max(160).optional(),
  rationale: z.string().max(500),
});
export type CampaignStep = z.infer<typeof StepSchema>;

const PlanSchema = z.object({
  steps: z.array(StepSchema).min(5).max(15),
});

const TOOL = {
  name: "propose_release_campaign",
  description:
    "Piano editoriale completo per una release/lancio: teaser → build-up → reveal → drop day → post-release echo. Ogni tappa è pronta per diventare una Suggestion.",
  input_schema: {
    type: "object",
    required: ["steps"],
    properties: {
      steps: {
        type: "array",
        minItems: 5,
        maxItems: 15,
        items: {
          type: "object",
          required: [
            "forDate",
            "suggestedTime",
            "platform",
            "contentType",
            "phase",
            "hook",
            "caption",
            "hashtags",
            "rationale",
          ],
          properties: {
            forDate: { type: "string", description: "YYYY-MM-DD" },
            suggestedTime: {
              type: "string",
              pattern: "^\\d{2}:\\d{2}$",
              description: "HH:mm timezone creator",
            },
            platform: { type: "string", enum: PLATFORMS },
            contentType: { type: "string", enum: CONTENT_TYPES },
            phase: {
              type: "string",
              enum: ["teaser", "build", "reveal", "drop", "echo", "post_release"],
              description:
                "teaser: 3-5 settimane prima. build: 2-3 settimane. reveal (cover/snippet): 1 settimana. drop: giorno uscita. echo: entro 48h. post_release: 1-2 settimane dopo.",
            },
            hook: { type: "string", minLength: 5, maxLength: 240 },
            caption: { type: "string", minLength: 10, maxLength: 2200 },
            hashtags: {
              type: "array",
              items: { type: "string" },
              maxItems: 10,
            },
            cta: { type: "string", maxLength: 160 },
            rationale: { type: "string", maxLength: 500 },
          },
        },
      },
    },
  },
} as const;

export async function generateCampaign(input: CampaignInput): Promise<CampaignStep[]> {
  const { project } = input;
  const labels = getKindLabels(project.kind);
  const kindDisplay = KIND_DISPLAY[project.kind];
  const availableTypes =
    input.availableTypes ?? KIND_CAMPAIGN_TYPES[project.kind];

  if (!availableTypes.includes(input.type)) {
    throw new Error(
      `CampaignType "${input.type}" non valido per kind ${project.kind}. ` +
        `Validi: ${availableTypes.join(", ")}`,
    );
  }

  const promptPayload = {
    kind: project.kind,
    kindLabel: labels.creator,
    kindDisplay,
    creator: {
      displayName: project.displayName,
      niche: project.niche,
      city: project.city,
    },
    campaign: {
      title: input.title,
      type: input.type,
      availableTypes,
      releaseDate: input.releaseDate,
      preSaveUrl: input.preSaveUrl,
      goal: input.goal,
    },
    personas: input.personas,
  };

  const userMessage = `Costruisci il piano editoriale per questa release/lancio di un ${labels.creator} (${kindDisplay}):

\`\`\`json
${JSON.stringify(promptPayload, null, 2)}
\`\`\`

Tipo campagna: **${input.type}** (scelto fra: ${availableTypes.join(", ")} — l'unico set valido per il kind ${project.kind}).

Struttura attesa (5-15 tappe):
- **Teaser** (3-5 settimane prima): ganci oscuri, "sto preparando qualcosa", BTS, snippet brevi in storie
- **Build** (1-3 settimane prima): data drop annunciata, pre-save / pre-iscrizione CTA, snippet più lunghi, duet/reaction dalla scena
- **Reveal** (3-7 giorni prima): copertina/thumbnail ufficiale, featurings/guest svelati, contest snippet
- **Drop day**: post principale su ogni piattaforma rilevante, stories hype, IG/TikTok live se possibile
- **Echo** (24-48h dopo): thank you post, screenshot reaction fans, primi numeri
- **Post-release** (1-2 settimane dopo): reaction a cover/freestyle altrui, tutorial, storytelling approfondito

Regole:
- Adatta tono e formati al kind ${project.kind}: per un ${labels.creator}, "${labels.content}" sono i format core e il KPI primario è "${labels.goal}".
- Distribuisci le tappe in modo coerente con le date (non ammassarle il giorno drop).
- Ogni caption deve essere pronta all'uso, in italiano, con hook nei primi 2 secondi di lettura.
- Il rationale di ogni tappa deve citare almeno un segnale neuromarketing (es. "sfrutta reward prediction: promessa di payoff con drop annunciato").`;

  const response = await anthropic().messages.create({
    model: MARKETING_MODEL,
    max_tokens: 6000,
    system: MARKETING_SYSTEM_BLOCKS,
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find(
    (b): b is Extract<typeof b, { type: "tool_use" }> => b.type === "tool_use",
  );
  if (!toolUse) throw new Error("Claude non ha chiamato il tool propose_release_campaign");
  const parsed = PlanSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new Error(`Output non valido: ${parsed.error.message}`);
  }
  return parsed.data.steps;
}
