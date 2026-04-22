import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(req: Request): boolean {
  return req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
}

// Analizza i post pubblicati oggi e produce un breve feedback in log.
// Milestone M8 → scriverà un record di Feedback dedicato e invierà email via Resend.
export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const todaysPosts = await prisma.post.findMany({
    where: { postedAt: { gte: since } },
    include: { account: true },
  });

  const summary = todaysPosts.map((p) => ({
    platform: p.account.platform,
    postedAt: p.postedAt,
    engagement: (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0),
    reach: p.reach ?? null,
  }));

  return NextResponse.json({ ok: true, count: todaysPosts.length, summary });
}
