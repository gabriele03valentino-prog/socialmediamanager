import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createGoalForUser } from "@/lib/goals";

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

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const goals = await prisma.goal.findMany({
    where: { userId: session.user.id },
    orderBy: [{ status: "asc" }, { targetDate: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ ok: true, goals });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const goal = await createGoalForUser(session.user.id, {
    platform: parsed.data.platform,
    metric: parsed.data.metric,
    targetValue: parsed.data.targetValue,
    targetDate: parsed.data.targetDate
      ? new Date(`${parsed.data.targetDate}T23:59:59Z`)
      : null,
    note: parsed.data.note,
  });

  return NextResponse.json({ ok: true, goal });
}
