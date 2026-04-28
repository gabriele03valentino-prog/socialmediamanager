import Anthropic from "@anthropic-ai/sdk";
import type { CreatorKind, Platform, TrendKind } from "@prisma/client";

// Trend hunter helper: chiede a Claude trend italiani caldi per un kind di creator.
// Mirror del pattern di feedback.ts: client lazy + tool-use + zero testo libero.

const MODEL = "claude-sonnet-4-6";

let _anthropic: Anthropic | null = null;
function anthropic(): Anthropic {
  if (_anthropic) return _anthropic;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY non impostata");
  }
  _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

const TREND_KINDS: readonly TrendKind[] = [
  "SOUND",
  "FORMAT",
  "TOPIC",
  "HASHTAG",
  "CHALLENGE",
];
const PLATFORMS: readonly Platform[] = [
  "INSTAGRAM",
  "FACEBOOK",
  "TIKTOK",
  "YOUTUBE",
  "SPOTIFY",
];

const SYSTEM_PROMPT = `Sei un trend hunter per il mercato social italiano (IG/TikTok/YouTube/Spotify).
Conosci i trend musicali e di creator italiani in base al tuo training.
Proponi trend tarati per il kind del progetto. Includi sempre data di scadenza
realistica (i trend social raramente durano >30 giorni).
Risponderai chiamando il tool propose_trends. Niente testo libero.
Se non hai certezza su un trend, NON inventare — meglio meno proposte ma realistiche.`;

const TOOL = {
  name: "propose_trends",
  description: "Proponi trend italiani caldi per un kind di creator.",
  input_schema: {
    type: "object",
    required: ["trends"],
    properties: {
      trends: {
        type: "array",
        minItems: 1,
        maxItems: 10,
        items: {
          type: "object",
          required: ["kind", "name", "description", "platforms"],
          properties: {
            kind: { type: "string", enum: ["SOUND", "FORMAT", "TOPIC", "HASHTAG", "CHALLENGE"] },
            name: { type: "string", maxLength: 120 },
            description: { type: "string", maxLength: 500 },
            platforms: {
              type: "array",
              items: { type: "string", enum: ["INSTAGRAM", "FACEBOOK", "TIKTOK", "YOUTUBE", "SPOTIFY"] },
            },
            expiresInDays: { type: "number", minimum: 3, maximum: 60 },
          },
        },
      },
    },
  },
} as const;

export interface SuggestedTrend {
  kind: TrendKind;
  name: string;
  description: string;
  platforms: Platform[];
  expiresInDays: number;
}

export const TRENDS_MODEL = MODEL;

interface ToolInputTrend {
  kind?: string;
  name?: string;
  description?: string;
  platforms?: string[];
  expiresInDays?: number;
}

export async function suggestTrends(
  project: { id: string; kind: CreatorKind; niche: string | null; displayName: string },
  kind: TrendKind | undefined,
  count: number,
): Promise<SuggestedTrend[]> {
  const today = new Date().toISOString().slice(0, 10);
  const userMessage = `Progetto: ${project.displayName} (${project.kind})${
    project.niche ? ` — nicchia ${project.niche}` : ""
  }.
Data oggi: ${today}.
Proponi ${count} trend ${kind ? `di tipo ${kind}` : "vari"} attualmente caldi in Italia.`;

  const res = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = res.content.find(
    (b): b is Extract<typeof b, { type: "tool_use" }> => b.type === "tool_use",
  );
  if (!toolUse) return [];

  const input = toolUse.input as { trends?: ToolInputTrend[] };
  const raw = Array.isArray(input.trends) ? input.trends : [];

  const validKinds = new Set<string>(TREND_KINDS);
  const validPlatforms = new Set<string>(PLATFORMS);

  const trends: SuggestedTrend[] = [];
  for (const t of raw) {
    if (!t || typeof t !== "object") continue;
    if (!t.kind || !validKinds.has(t.kind)) continue;
    if (!t.name || typeof t.name !== "string") continue;
    if (!t.description || typeof t.description !== "string") continue;
    if (!Array.isArray(t.platforms) || t.platforms.length === 0) continue;
    const platforms = t.platforms.filter((p): p is Platform =>
      typeof p === "string" && validPlatforms.has(p),
    );
    if (platforms.length === 0) continue;
    const expiresInDays =
      typeof t.expiresInDays === "number" && t.expiresInDays >= 3 && t.expiresInDays <= 60
        ? Math.round(t.expiresInDays)
        : 14;
    trends.push({
      kind: t.kind as TrendKind,
      name: t.name.slice(0, 120),
      description: t.description.slice(0, 500),
      platforms,
      expiresInDays,
    });
  }

  return trends;
}
