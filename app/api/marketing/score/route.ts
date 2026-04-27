import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
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

export async function POST(req: Request) {
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

  const profile = await prisma.artistProfile.findUnique({
    where: { userId: session.user.id },
  });

  let input;
  if (suggestionId) {
    const s = await prisma.suggestion.findUnique({ where: { id: suggestionId } });
    if (!s || s.userId !== session.user.id) {
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
      artist: profile
        ? { stageName: profile.stageName, genre: profile.genre, city: profile.city }
        : undefined,
    };
  } else {
    const d = await prisma.draft.findUnique({ where: { id: draftId } });
    if (!d || d.userId !== session.user.id) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    input = {
      platform: d.platform,
      contentType: d.contentType,
      caption: d.caption,
      hashtags: d.hashtags,
      mediaNotes: d.mediaNotes,
      artist: profile
        ? { stageName: profile.stageName, genre: profile.genre, city: profile.city }
        : undefined,
    };
  }

  try {
    const result = await scoreContent(input);
    const saved = await prisma.neuroScore.upsert({
      where: suggestionId
        ? { suggestionId }
        : { draftId: draftId! },
      create: {
        userId: session.user.id,
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
}
