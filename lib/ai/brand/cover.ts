import type { CreatorKind } from "@prisma/client";
import { z } from "zod";
import { getKindLabels, KIND_DISPLAY } from "@/lib/kind-labels";
import { anthropic, BRAND_MODEL } from "./claude";
import { BRAND_SYSTEM_BLOCKS } from "./prompts";

/**
 * Project shape consumed dal modulo brand/cover (M16).
 * Sostituisce il vecchio lookup ArtistProfile via userId.
 */
export interface CoverProject {
  id: string;
  kind: CreatorKind;
  displayName: string;
  niche: string | null;
  city: string | null;
  bio: string | null;
}

export const CoverInputSchema = z.object({
  releaseTitle: z.string().min(1),
  releaseType: z.enum(["singolo", "ep", "album"]),
  mood: z.string().min(1),
  story: z.string().min(5).max(1000),
  keywords: z.array(z.string()).min(1).max(6),
  // Identità del creator (presa da BrandIdentity se presente)
  palette: z.array(z.string()).max(6).optional(), // hex values
  moodKeywordsBrand: z.array(z.string()).max(10).optional(),
});
export type CoverInputBody = z.infer<typeof CoverInputSchema>;

export interface CoverInput extends CoverInputBody {
  project: CoverProject;
}

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
    "Genera brief per la cover/thumbnail di una release/episodio/contenuto, coerente con la brand identity del creator.",
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
        description: "Titolo della release/contenuto, ecoato per riferimento",
      },
      brief: {
        type: "string",
        description:
          "Descrizione completa del concept visivo: soggetto, composizione, illuminazione, colori dominanti, texture, mood emotivo. Italiano.",
      },
      claudeDesignPrompt: {
        type: "string",
        description:
          "Prompt copia-incollabile in claude.ai/design per generare la cover. Include palette hex e riferimenti visivi.",
      },
      mjPrompt: {
        type: "string",
        description:
          "Prompt Midjourney ottimizzato (soggetto, medium, dettagli, lighting, camera, --ar adatto al formato, --style raw --v 6)",
      },
      ideogramPrompt: {
        type: "string",
        description:
          "Prompt per Ideogram (particolarmente bravo con testo sulla cover, utile se il titolo è parte del design).",
      },
    },
  },
} as const;

/**
 * Restituisce il "tipo di artwork" da generare in funzione del kind del creator.
 * Influenza titolo del brief, formato consigliato e linguaggio del prompt.
 */
function coverKindFor(kind: CreatorKind): {
  artworkLabel: string;
  format: string;
  thumbContext: string;
} {
  switch (kind) {
    case "ARTIST":
      return {
        artworkLabel: "cover singolo / EP / album",
        format: "1:1 (Spotify/Apple Music)",
        thumbContext: "thumb 120x120 leggibile in feed Spotify/Apple Music",
      };
    case "YOUTUBER":
      return {
        artworkLabel: "thumbnail video YouTube",
        format: "16:9 (1280x720, YouTube)",
        thumbContext: "thumb leggibile a 246x138 in home/sidebar YouTube",
      };
    case "PODCASTER":
      return {
        artworkLabel: "cover episodio podcast",
        format: "1:1 (Spotify/Apple Podcasts)",
        thumbContext: "thumb 120x120 leggibile nelle app podcast",
      };
    case "INFLUENCER":
      return {
        artworkLabel: "cover post/reel principale",
        format: "1:1 o 9:16 (IG/TikTok)",
        thumbContext: "thumb leggibile in griglia profilo IG (110x110)",
      };
    case "DIVULGATORE":
      return {
        artworkLabel: "thumbnail video / cover carousel didattico",
        format: "16:9 video, 1:1 carousel",
        thumbContext: "leggibile sia su YouTube sia su feed IG",
      };
    case "BRAND":
      return {
        artworkLabel: "cover campagna / key visual",
        format: "1:1 + adattamento 9:16 e 16:9",
        thumbContext: "leggibile in griglia profilo e ad-preview",
      };
    default:
      return {
        artworkLabel: "cover contenuto",
        format: "1:1",
        thumbContext: "thumb 120x120 leggibile",
      };
  }
}

export async function generateCoverBrief(
  input: CoverInput,
): Promise<CoverBriefOutput> {
  const { project } = input;
  const labels = getKindLabels(project.kind);
  const kindDisplay = KIND_DISPLAY[project.kind];
  const coverKind = coverKindFor(project.kind);

  const promptPayload = {
    kind: project.kind,
    kindLabel: labels.creator,
    kindDisplay,
    artworkLabel: coverKind.artworkLabel,
    format: coverKind.format,
    creator: {
      displayName: project.displayName,
      niche: project.niche,
      city: project.city,
    },
    release: {
      title: input.releaseTitle,
      type: input.releaseType,
      mood: input.mood,
      story: input.story,
      keywords: input.keywords,
    },
    brand: {
      palette: input.palette,
      moodKeywordsBrand: input.moodKeywordsBrand,
    },
  };

  const userMessage = `Genera il brief per la **${coverKind.artworkLabel}** di questo contenuto di un ${labels.creator} (${kindDisplay}):

\`\`\`json
${JSON.stringify(promptPayload, null, 2)}
\`\`\`

La copertina deve:
- Essere memorabile al primo scroll (${coverKind.thumbContext})
- Formato target: ${coverKind.format}
- Raccontare in un colpo d'occhio il mood del contenuto
- Essere coerente con la brand identity (palette + moodKeywordsBrand se forniti)
- Evitare cliché del kind (es. foto del volto in primo piano per trap = visto mille volte; per YOUTUBER thumbnail urlante = saturo)
- Ogni prompt (Claude/Midjourney/Ideogram) deve essere ottimizzato per quel tool specifico, includendo l'aspect ratio corretto per il kind.`;

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
