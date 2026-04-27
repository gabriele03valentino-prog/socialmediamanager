import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { withProjectRoute } from "@/lib/active-project";
import { scoreContent } from "@/lib/ai/marketing/neuroscore";
import { prisma } from "@/lib/db";
import { LIMITS, rateLimitOrResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  suggestionId: z.string().optional(),
  draftId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const limited = rateLimitOrResponse(
    session.user.id,
    "marketing.score",
    LIMITS.marketingScore,
  );
  if (limited) return limited;
  const body = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { suggestionId, draftId } = parsed.data;
  if (!suggestionId && !draftId) {
    return NextResponse.json(
      { error: "require_suggestionId_or_draftId" },
      { status: 400 },
    );
  }

  return withProjectRoute(req, async (project) => {
    // Universal signals: niente kind branching, ma diamo al modello il
    // contesto creator generico (displayName/niche/city) per radicare le
    // valutazioni neuro al brand del progetto attivo.
    const creatorCtx = {
      stageName: project.displayName,
      genre: project.niche ?? undefined,
      city: project.city,
    };

    let input;
    if (suggestionId) {
      const s = await prisma.suggestion.findUnique({ where: { id: suggestionId } });
      if (!s || s.projectId !== project.id) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      input = {
        platform: s.platform,
        contentType: s.contentType,
        hook: s.hook,
        caption: s.caption,
        hashtags: s.hashtags,
        suggestedTime: s.suggestedTime,
        cta: s.cta,
        artist: creatorCtx,
      };
    } else {
      const d = await prisma.draft.findUnique({ where: { id: draftId } });
      if (!d || d.projectId !== project.id) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      input = {
        platform: d.platform,
        contentType: d.contentType,
        caption: d.caption,
        hashtags: d.hashtags,
        mediaNotes: d.mediaNotes,
        artist: creatorCtx,
      };
    }

    try {
      const result = await scoreContent(input);
      const saved = await prisma.neuroScore.upsert({
        where: suggestionId ? { suggestionId } : { draftId: draftId! },
        create: {
          projectId: project.id,
          suggestionId,
          draftId,
          score: result.score,
          breakdown: result.breakdown as never,
          improvements: result.improvements as never,
          generatedBy: "claude-sonnet-4-6",
        },
        update: {
          score: result.score,
          breakdown: result.breakdown as never,
          improvements: result.improvements as never,
          generatedBy: "claude-sonnet-4-6",
        },
      });
      return NextResponse.json({ ok: true, neuroScore: saved, summary: result.summary });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
