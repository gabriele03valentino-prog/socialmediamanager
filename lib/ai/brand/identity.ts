import type { CreatorKind } from "@prisma/client";
import { z } from "zod";
import { getKindLabels, KIND_DISPLAY } from "@/lib/kind-labels";
import { anthropic, BRAND_MODEL } from "./claude";
import { BRAND_SYSTEM_BLOCKS } from "./prompts";

/**
 * Project shape consumed dal modulo brand/identity (M16).
 * Sostituisce il vecchio lookup ArtistProfile via userId.
 */
export interface IdentityProject {
  id: string;
  kind: CreatorKind;
  displayName: string;
  niche: string | null;
  city: string | null;
  bio: string | null;
}

export const IdentityInputSchema = z.object({
  moodKeywords: z.array(z.string()).max(10),
  referenceArtists: z.array(z.string()).max(5),
  favoriteColors: z.array(z.string()).max(5),
});
export type IdentityInputBody = z.infer<typeof IdentityInputSchema>;

export interface IdentityInput extends IdentityInputBody {
  project: IdentityProject;
}

const PaletteColor = z.object({
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  role: z.enum(["primary", "accent", "neutral-dark", "neutral-light", "highlight"]),
  usage: z.string().min(3).max(200),
});

const Typography = z.object({
  title: z.object({
    family: z.string().min(1),
    weights: z.array(z.string()).min(1),
    rationale: z.string().min(5).max(300),
  }),
  body: z.object({
    family: z.string().min(1),
    weights: z.array(z.string()).min(1),
    rationale: z.string().min(5).max(300),
  }),
});

const ToneOfVoice = z.object({
  adjectives: z.array(z.string()).min(3).max(6),
  examples: z.array(z.string()).min(2).max(5),
});

export const BrandIdentitySchema = z.object({
  palette: z.array(PaletteColor).min(4).max(6),
  typography: Typography,
  toneOfVoice: ToneOfVoice,
  moodKeywords: z.array(z.string()).min(5).max(10),
  logoBrief: z.string().min(50).max(1500),
  logoSvg: z.string().min(20).max(4000),
  claudeDesignPrompt: z.string().min(50).max(2000),
  mjPrompt: z.string().min(30).max(1500),
});
export type BrandIdentityOutput = z.infer<typeof BrandIdentitySchema>;

const TOOL = {
  name: "generate_brand_identity",
  description:
    "Genera identità visiva completa coerente con il profilo del creator (kind-aware).",
  input_schema: {
    type: "object",
    required: [
      "palette",
      "typography",
      "toneOfVoice",
      "moodKeywords",
      "logoBrief",
      "logoSvg",
      "claudeDesignPrompt",
      "mjPrompt",
    ],
    properties: {
      palette: {
        type: "array",
        minItems: 4,
        maxItems: 6,
        items: {
          type: "object",
          required: ["hex", "role", "usage"],
          properties: {
            hex: {
              type: "string",
              pattern: "^#[0-9A-Fa-f]{6}$",
              description: "Hex esadecimale a 6 cifre, inclusa #",
            },
            role: {
              type: "string",
              enum: [
                "primary",
                "accent",
                "neutral-dark",
                "neutral-light",
                "highlight",
              ],
            },
            usage: {
              type: "string",
              description:
                "Dove usarlo concretamente (es. 'Sfondo cover Spotify', 'Testo CTA', 'Accento titoli')",
            },
          },
        },
      },
      typography: {
        type: "object",
        required: ["title", "body"],
        properties: {
          title: {
            type: "object",
            required: ["family", "weights", "rationale"],
            properties: {
              family: {
                type: "string",
                description:
                  "Nome esatto di un Google Font esistente (es. 'Anton', 'Space Grotesk', 'IBM Plex Mono'). Verifica in google.com/fonts.",
              },
              weights: {
                type: "array",
                items: { type: "string" },
                description: "Es. ['700', '900']",
              },
              rationale: { type: "string" },
            },
          },
          body: {
            type: "object",
            required: ["family", "weights", "rationale"],
            properties: {
              family: { type: "string" },
              weights: { type: "array", items: { type: "string" } },
              rationale: { type: "string" },
            },
          },
        },
      },
      toneOfVoice: {
        type: "object",
        required: ["adjectives", "examples"],
        properties: {
          adjectives: {
            type: "array",
            items: { type: "string" },
            minItems: 3,
            maxItems: 6,
          },
          examples: {
            type: "array",
            items: { type: "string" },
            minItems: 2,
            maxItems: 5,
            description: "Esempi di frasi/caption nel tono giusto.",
          },
        },
      },
      moodKeywords: {
        type: "array",
        items: { type: "string" },
        minItems: 5,
        maxItems: 10,
      },
      logoBrief: {
        type: "string",
        description: "Descrizione discorsiva del concept del logo.",
      },
      logoSvg: {
        type: "string",
        description:
          "SVG inline minimal, monogram o logotipo flat. Deve iniziare con <svg e finire con </svg>. ViewBox 0 0 100 100 preferito. Usa solo path/rect/circle/polygon/text con fill colorato dalla palette.",
      },
      claudeDesignPrompt: {
        type: "string",
        description:
          "Prompt pronto per claude.ai/design: inclusi stile, palette con hex, mood, composizione, aspect ratio. Italiano o inglese, molto descrittivo.",
      },
      mjPrompt: {
        type: "string",
        description:
          "Prompt Midjourney strutturato: soggetto, stile, lighting, composizione, --ar 1:1 --style raw --v 6 dove ha senso.",
      },
    },
  },
} as const;

export async function generateBrandIdentity(
  input: IdentityInput,
): Promise<BrandIdentityOutput> {
  const { project } = input;
  const labels = getKindLabels(project.kind);
  const kindDisplay = KIND_DISPLAY[project.kind];
  const niche = project.niche?.trim() || "non specificata";

  const promptPayload = {
    kind: project.kind,
    kindLabel: labels.creator,
    kindDisplay,
    creator: {
      displayName: project.displayName,
      niche: project.niche,
      city: project.city,
      bio: project.bio,
    },
    moodKeywords: input.moodKeywords,
    referenceArtists: input.referenceArtists,
    favoriteColors: input.favoriteColors,
  };

  const userMessage = `Genera l'identità visiva per ${kindDisplay} in nicchia ${niche}:

\`\`\`json
${JSON.stringify(promptPayload, null, 2)}
\`\`\`

Adatta tono e linguaggio al kind ${project.kind} (un ${labels.creator}). Esempi di tone-of-voice devono suonare come scriverebbe questo specifico tipo di creator.

Vincoli SVG logo:
- Usa viewBox="0 0 100 100"
- Dimensione massima del file ~2KB
- Solo forme geometriche base + eventuale testo con Google Font nominato nel campo typography.title
- Deve funzionare in monocromo (un solo colore) e a colori
- Niente gradient complessi: ammesso un linearGradient semplice se serve
- Leggibile a 32px e a 512px`;

  const response = await anthropic().messages.create({
    model: BRAND_MODEL,
    max_tokens: 4096,
    system: BRAND_SYSTEM_BLOCKS,
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find(
    (b): b is Extract<typeof b, { type: "tool_use" }> => b.type === "tool_use",
  );
  if (!toolUse) throw new Error("Claude non ha chiamato il tool generate_brand_identity");
  const parsed = BrandIdentitySchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new Error(`Output non valido: ${parsed.error.message}`);
  }
  return parsed.data;
}
