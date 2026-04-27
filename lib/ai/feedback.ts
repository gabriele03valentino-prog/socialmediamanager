import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";

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

const FEEDBACK_SYSTEM = `Sei il social media manager personale di un creator italiano.
Il tipo di creator (kind) è indicato nel contesto: ARTIST (musicista),
YOUTUBER, INFLUENCER, DIVULGATORE, PODCASTER, BRAND. Adatta il tono e i
KPI citati al kind.

Analizzi le performance dei post pubblicati oggi e scrivi un feedback **breve**
(max 4 frasi in italiano) con:
1. Un titolo punchy di max 10 parole (la "headline")
2. Un corpo di 2-4 frasi concrete: cosa ha funzionato, cosa no, 1 azione
   per domani — coerente col kind.

Risponderai chiamando il tool daily_feedback. Niente testo libero.`;

const TOOL = {
  name: "daily_feedback",
  description: "Feedback giornaliero sintetico",
  input_schema: {
    type: "object",
    required: ["headline", "body"],
    properties: {
      headline: { type: "string", minLength: 5, maxLength: 120 },
      body: { type: "string", minLength: 20, maxLength: 800 },
    },
  },
} as const;

export async function generateDailyFeedback(
  project: { id: string; kind: string; displayName: string },
  forDate: Date,
): Promise<{ headline: string; body: string; postsCount: number; generatedBy: string } | null> {
  const projectId = project.id;
  const start = new Date(forDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const [todayPosts, avgLast30] = await Promise.all([
    prisma.post.findMany({
      where: {
        account: { projectId },
        postedAt: { gte: start, lt: end },
      },
      include: { account: true },
    }),
    prisma.post.findMany({
      where: {
        account: { projectId },
        postedAt: {
          gte: new Date(start.getTime() - 30 * 86_400_000),
          lt: start,
        },
      },
    }),
  ]);

  if (todayPosts.length === 0) return null;

  const avgEng =
    avgLast30.reduce(
      (s, p) => s + (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0),
      0,
    ) / Math.max(avgLast30.length, 1);

  const context = {
    project: { kind: project.kind, displayName: project.displayName },
    date: start.toISOString().slice(0, 10),
    avgEngagementLast30d: Math.round(avgEng),
    postsToday: todayPosts.map((p) => ({
      platform: p.account.platform,
      mediaType: p.mediaType,
      postedAt: p.postedAt.toISOString(),
      likes: p.likes,
      comments: p.comments,
      shares: p.shares,
      saves: p.saves,
      views: p.views,
      reach: p.reach,
      caption: p.caption?.slice(0, 140),
    })),
  };

  const res = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 512,
    system: FEEDBACK_SYSTEM,
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [
      {
        role: "user",
        content: `Performance di oggi:\n\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\``,
      },
    ],
  });

  const toolUse = res.content.find(
    (b): b is Extract<typeof b, { type: "tool_use" }> => b.type === "tool_use",
  );
  if (!toolUse) return null;
  const input = toolUse.input as { headline?: string; body?: string };
  if (!input.headline || !input.body) return null;
  return {
    headline: input.headline,
    body: input.body,
    postsCount: todayPosts.length,
    generatedBy: MODEL,
  };
}
