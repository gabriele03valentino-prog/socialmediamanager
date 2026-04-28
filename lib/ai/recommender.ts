import Anthropic from "@anthropic-ai/sdk";
import type { ContentType, Platform } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { buildContext } from "./context-builder";
import { RECOMMENDER_SYSTEM_PROMPT_BLOCKS } from "./prompts";

// Anthropic SDK client. Inizializzato lazy per evitare di lanciare errori
// durante il build statico se la env var non è settata in CI.
let _anthropic: Anthropic | null = null;
function anthropic(): Anthropic {
  if (_anthropic) return _anthropic;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY non impostata");
  }
  _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

export const MODEL = "claude-sonnet-4-6";

// Schema del tool che Claude chiamerà.
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

const SuggestionSchema = z.object({
  forDate: z.string().describe("YYYY-MM-DD"),
  platform: z.enum(PLATFORMS as [Platform, ...Platform[]]),
  contentType: z.enum(CONTENT_TYPES as [ContentType, ...ContentType[]]),
  hook: z.string().min(5).max(240),
  caption: z.string().min(10).max(2200),
  hashtags: z.array(z.string()).max(10),
  cta: z.string().max(160).optional(),
  suggestedTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .describe("HH:mm, timezone utente"),
  rationale: z.string().max(500),
});

const PlanSchema = z.object({
  suggestions: z.array(SuggestionSchema).min(5).max(10),
});

const PROPOSE_PLAN_TOOL = {
  name: "propose_weekly_plan",
  description:
    "Proponi un piano editoriale per i prossimi 7 giorni. Un suggerimento al giorno + 1-3 bonus opzionali per giornate di punta.",
  input_schema: {
    type: "object",
    required: ["suggestions"],
    properties: {
      suggestions: {
        type: "array",
        minItems: 5,
        maxItems: 10,
        items: {
          type: "object",
          required: [
            "forDate",
            "platform",
            "contentType",
            "hook",
            "caption",
            "hashtags",
            "suggestedTime",
            "rationale",
          ],
          properties: {
            forDate: { type: "string", description: "YYYY-MM-DD" },
            platform: { type: "string", enum: PLATFORMS },
            contentType: { type: "string", enum: CONTENT_TYPES },
            hook: { type: "string", minLength: 5, maxLength: 240 },
            caption: { type: "string", minLength: 10, maxLength: 2200 },
            hashtags: {
              type: "array",
              maxItems: 10,
              items: { type: "string" },
            },
            cta: { type: "string", maxLength: 160 },
            suggestedTime: {
              type: "string",
              pattern: "^\\d{2}:\\d{2}$",
              description: "HH:mm nel timezone utente",
            },
            rationale: {
              type: "string",
              maxLength: 500,
              description: "Perché questo suggerimento, citando i dati dell'utente.",
            },
          },
        },
      },
    },
  },
} as const;

export async function generateWeeklyPlan(projectId: string): Promise<number> {
  const ctx = await buildContext(projectId);

  const userMessage = `Ecco il contesto attuale del progetto in formato JSON. Genera il piano settimanale chiamando il tool propose_weekly_plan.

\`\`\`json
${JSON.stringify(ctx, null, 2)}
\`\`\``;

  const response = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: RECOMMENDER_SYSTEM_PROMPT_BLOCKS,
    tools: [PROPOSE_PLAN_TOOL],
    tool_choice: { type: "tool", name: PROPOSE_PLAN_TOOL.name },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find(
    (b): b is Extract<typeof b, { type: "tool_use" }> => b.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error("Claude non ha chiamato il tool propose_weekly_plan");
  }

  const parsed = PlanSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new Error(`Output di Claude non valido: ${parsed.error.message}`);
  }

  const { suggestions } = parsed.data;

  const created = await prisma.$transaction(
    suggestions.map((s) =>
      prisma.suggestion.create({
        data: {
          projectId,
          forDate: new Date(`${s.forDate}T00:00:00Z`),
          platform: s.platform,
          contentType: s.contentType,
          hook: s.hook,
          caption: s.caption,
          hashtags: s.hashtags,
          cta: s.cta,
          suggestedTime: s.suggestedTime,
          rationale: s.rationale,
          generatedBy: MODEL,
        },
      }),
    ),
  );

  return created.length;
}
