import { NextResponse } from "next/server";
import { generateDailyFeedback } from "@/lib/ai/feedback";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(req: Request): boolean {
  return req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const users = await prisma.user.findMany({ select: { id: true } });
  const report: Array<{ userId: string; written: boolean; error?: string }> = [];

  for (const user of users) {
    try {
      const feedback = await generateDailyFeedback(user.id, today);
      if (!feedback) {
        report.push({ userId: user.id, written: false });
        continue;
      }
      await prisma.dailyFeedback.upsert({
        where: {
          userId_forDate: { userId: user.id, forDate: today },
        },
        create: {
          userId: user.id,
          forDate: today,
          headline: feedback.headline,
          body: feedback.body,
          postsCount: feedback.postsCount,
          generatedBy: "claude-sonnet-4-6",
        },
        update: {
          headline: feedback.headline,
          body: feedback.body,
          postsCount: feedback.postsCount,
        },
      });
      report.push({ userId: user.id, written: true });
    } catch (err) {
      report.push({
        userId: user.id,
        written: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ ok: true, at: new Date().toISOString(), report });
}
