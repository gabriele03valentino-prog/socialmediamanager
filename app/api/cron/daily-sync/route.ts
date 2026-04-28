import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncProjectAccounts } from "@/lib/sync";
import { evaluateProjectGoals } from "@/lib/goals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  if (!process.env.CRON_SECRET) return false;
  return req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
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

  return NextResponse.json({ ok: true, count: projects.length, results });
}
