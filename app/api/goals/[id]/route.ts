import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { withProjectRoute } from "@/lib/active-project";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Patch = z.object({
  status: z.enum(["ACTIVE", "ACHIEVED", "EXPIRED", "ARCHIVED"]).optional(),
  note: z.string().max(500).optional(),
  targetValue: z.number().int().positive().max(100_000_000).optional(),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

async function loadInProject(id: string, projectId: string) {
  const goal = await prisma.goal.findUnique({ where: { id } });
  if (!goal || goal.projectId !== projectId) return null;
  return goal;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  return withProjectRoute(req, async (project) => {
    const goal = await loadInProject(id, project.id);
    if (!goal) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const body = await req.json().catch(() => ({}));
    const parsed = Patch.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const updated = await prisma.goal.update({
      where: { id },
      data: {
        ...parsed.data,
        targetDate:
          parsed.data.targetDate === undefined
            ? undefined
            : parsed.data.targetDate === null
              ? null
              : new Date(`${parsed.data.targetDate}T23:59:59Z`),
      },
    });
    return NextResponse.json({ ok: true, goal: updated });
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  return withProjectRoute(req, async (project) => {
    const goal = await loadInProject(id, project.id);
    if (!goal) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    await prisma.goal.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
