import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { TrendKind } from "@prisma/client";
import { auth } from "@/auth";
import { withProjectRoute } from "@/lib/active-project";
import { prisma } from "@/lib/db";
import { LIMITS, rateLimitOrResponse } from "@/lib/rate-limit";
import { suggestTrends, TRENDS_MODEL } from "@/lib/ai/trends";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z
  .object({
    kind: z.nativeEnum(TrendKind).optional(),
    count: z.number().int().min(1).max(10).optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  return withProjectRoute(req, async (project) => {
    const limited = rateLimitOrResponse(
      userId,
      "trends.suggest",
      LIMITS.trendsSuggest,
      project.id,
    );
    if (limited) return limited;

    const json = await req.json().catch(() => ({}));
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const count = parsed.data.count ?? 5;

    try {
      const proposed = await suggestTrends(
        {
          id: project.id,
          kind: project.kind,
          niche: project.niche,
          displayName: project.displayName,
        },
        parsed.data.kind,
        count,
      );

      if (proposed.length === 0) {
        return NextResponse.json({ trends: [] });
      }

      const now = Date.now();
      const created = await prisma.$transaction(
        proposed.map((t) =>
          prisma.trend.create({
            data: {
              projectId: project.id,
              kind: t.kind,
              name: t.name,
              description: t.description,
              platforms: t.platforms,
              status: "WARMING",
              expiresAt: new Date(now + t.expiresInDays * 24 * 60 * 60 * 1000),
              generatedBy: TRENDS_MODEL,
            },
          }),
        ),
      );

      return NextResponse.json({ trends: created });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[trends/suggest] anthropic failed", err);
      return NextResponse.json(
        { error: "anthropic_failed", details: msg },
        { status: 502 },
      );
    }
  });
}
