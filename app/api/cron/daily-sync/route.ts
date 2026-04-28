import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { syncProjectAccounts } from "@/lib/sync";
import { evaluateProjectGoals } from "@/lib/goals";
import {
  primaryMetric,
  evaluatePostMortem,
  extractInsightTags,
  median,
  type PrimaryMetric,
} from "@/lib/post-mortem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  if (!process.env.CRON_SECRET) return false;
  const got = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (got.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  if (!authorized(req)) return new NextResponse("forbidden", { status: 403 });

  const projects = await prisma.project.findMany({
    select: { id: true, userId: true, displayName: true },
  });

  const results: Array<{ projectId: string; ok: boolean; error?: string }> = [];

  for (const project of projects) {
    try {
      await syncProjectAccounts(project.id);
      try {
        await evaluateProjectGoals(project.id);
      } catch (err) {
        console.warn(`goals eval failed for ${project.id}`, err);
      }
      results.push({ projectId: project.id, ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`sync failed for ${project.id}: ${msg}`);
      results.push({ projectId: project.id, ok: false, error: msg });
    }
  }

  // Post-mortem pass (M19): valuta i post pubblicati 48-72h fa rispetto alla
  // baseline (mediana ultimi 30 giorni stessa platform+mediaType).
  let mortemsCreated = 0;
  const now = new Date();
  const targetWindowStart = new Date(now.getTime() - 72 * 60 * 60 * 1000);
  const targetWindowEnd = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const baselineWindow = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  for (const project of projects) {
    const candidates = await prisma.post.findMany({
      where: {
        account: { projectId: project.id },
        postedAt: { gte: targetWindowStart, lte: targetWindowEnd },
        postMortem: null,
      },
      include: { account: true },
    });

    for (const post of candidates) {
      const pm = primaryMetric(post.account.platform, post);
      if (!pm) continue;

      const baselinePosts = await prisma.post.findMany({
        where: {
          account: { projectId: project.id, platform: post.account.platform },
          mediaType: post.mediaType,
          postedAt: { gte: baselineWindow, lt: post.postedAt },
          id: { not: post.id },
        },
        select: {
          likes: true,
          comments: true,
          shares: true,
          saves: true,
          views: true,
          reach: true,
        },
      });

      const baselineValues = baselinePosts
        .map((b) => primaryMetric(post.account.platform, b))
        .filter((v): v is PrimaryMetric => v !== null)
        .map((v) => v.value);

      if (baselineValues.length < 3) continue; // not enough baseline data

      const baselineMed = median(baselineValues);
      if (baselineMed < 5) continue; // baseline troppo bassa, evita outlier flood
      const result = evaluatePostMortem(pm.value, baselineMed);

      try {
        await prisma.postMortem.create({
          data: {
            postId: post.id,
            projectId: project.id,
            platform: post.account.platform,
            contentType: post.mediaType,
            outcome: result.outcome,
            metric: pm.name,
            postValue: pm.value,
            baselineMed,
            ratio: result.ratio,
            caption: post.caption,
            hashtags: [],
            insightTags: extractInsightTags(post.caption),
          },
        });
        mortemsCreated++;
      } catch (err) {
        console.warn(`postmortem failed for ${post.id}`, err);
      }
    }
  }

  // Auto-expire trend con expiresAt scaduto (M18).
  const expired = await prisma.trend.updateMany({
    where: { status: "ACTIVE", expiresAt: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });

  return NextResponse.json({
    ok: true,
    count: projects.length,
    results,
    mortemsCreated,
    trendsExpired: expired.count,
  });
}
