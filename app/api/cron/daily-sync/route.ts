import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateWeeklyPlan } from "@/lib/ai/recommender";
import { syncAccount } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // 5 min su Vercel Pro; Hobby max 60s — vedi README per workaround.

// Protezione: Vercel Cron invia `Authorization: Bearer <CRON_SECRET>`.
function authorized(req: Request): boolean {
  const header = req.headers.get("authorization");
  return header === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({ include: { socialAccounts: true } });

  const report: Array<{ userId: string; synced: number; suggestions: number; errors: string[] }> = [];

  for (const user of users) {
    const errors: string[] = [];
    let synced = 0;
    for (const account of user.socialAccounts) {
      const res = await syncAccount(account);
      if (res.error) errors.push(`${account.platform}: ${res.error}`);
      if (res.metrics || res.posts > 0) synced += 1;
    }

    let suggestions = 0;
    try {
      if (user.socialAccounts.length > 0) {
        suggestions = await generateWeeklyPlan(user.id);
      }
    } catch (err) {
      errors.push(`recommender: ${err instanceof Error ? err.message : String(err)}`);
    }

    report.push({ userId: user.id, synced, suggestions, errors });
  }

  return NextResponse.json({ ok: true, at: new Date().toISOString(), report });
}
