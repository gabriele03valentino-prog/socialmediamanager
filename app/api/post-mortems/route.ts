import { type NextRequest, NextResponse } from "next/server";
import { Platform, PostOutcome } from "@prisma/client";
import { auth } from "@/auth";
import { withProjectRoute } from "@/lib/active-project";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OUTCOMES = new Set<PostOutcome>([
  "OUTLIER_HIGH",
  "ABOVE",
  "NORMAL",
  "BELOW",
  "OUTLIER_LOW",
]);

const PLATFORMS = new Set<Platform>([
  "INSTAGRAM",
  "FACEBOOK",
  "TIKTOK",
  "YOUTUBE",
  "SPOTIFY",
]);

function parseTake(value: string | null): number {
  const n = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(n) || n <= 0) return 50;
  return Math.min(n, 200);
}

function parseSkip(value: string | null): number {
  const n = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 10_000);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return withProjectRoute(req, async (project) => {
    const url = new URL(req.url);
    const outcomeParam = url.searchParams.get("outcome");
    const platformParam = url.searchParams.get("platform");
    const take = parseTake(url.searchParams.get("take"));
    const skip = parseSkip(url.searchParams.get("skip"));

    const where: {
      projectId: string;
      outcome?: PostOutcome;
      platform?: Platform;
    } = { projectId: project.id };

    if (outcomeParam) {
      const o = outcomeParam.toUpperCase() as PostOutcome;
      if (OUTCOMES.has(o)) where.outcome = o;
    }
    if (platformParam) {
      const p = platformParam.toUpperCase() as Platform;
      if (PLATFORMS.has(p)) where.platform = p;
    }

    const postMortems = await prisma.postMortem.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
    });

    return NextResponse.json({ postMortems });
  });
}
