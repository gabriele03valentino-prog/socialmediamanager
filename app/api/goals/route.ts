import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { withProjectRoute } from "@/lib/active-project";
import { prisma } from "@/lib/db";
import { createGoalForProject } from "@/lib/goals";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  platform: z.enum(["INSTAGRAM", "FACEBOOK", "TIKTOK", "YOUTUBE", "SPOTIFY"]),
  metric: z.enum(["FOLLOWERS", "AVG_VIEWS", "AVG_REACH", "MONTHLY_LISTENERS"]),
  targetValue: z.number().int().positive().max(100_000_000),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  note: z.string().max(500).optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return withProjectRoute(req, async (project) => {
    const goals = await prisma.goal.findMany({
      where: { projectId: project.id },
      orderBy: [{ status: "asc" }, { targetDate: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ ok: true, goals });
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return withProjectRoute(req, async (project) => {
    const body = await req.json().catch(() => ({}));
    const parsed = Body.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const goal = await createGoalForProject(project.id, {
      platform: parsed.data.platform,
      metric: parsed.data.metric,
      targetValue: parsed.data.targetValue,
      targetDate: parsed.data.targetDate
        ? new Date(`${parsed.data.targetDate}T23:59:59Z`)
        : null,
      note: parsed.data.note,
    });

    return NextResponse.json({ ok: true, goal });
  });
}
