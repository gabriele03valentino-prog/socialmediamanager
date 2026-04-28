import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Platform, TrendStatus } from "@prisma/client";
import { auth } from "@/auth";
import { withProjectRoute } from "@/lib/active-project";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Patch = z
  .object({
    status: z.nativeEnum(TrendStatus).optional(),
    expiresAt: z.string().datetime().nullable().optional(),
    platforms: z.array(z.nativeEnum(Platform)).min(1).optional(),
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(500).nullable().optional(),
  })
  .strict();

async function loadInProject(id: string, projectId: string) {
  const trend = await prisma.trend.findUnique({ where: { id } });
  if (!trend || trend.projectId !== projectId) return null;
  return trend;
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
    const trend = await loadInProject(id, project.id);
    if (!trend) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const body = await req.json().catch(() => ({}));
    const parsed = Patch.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const data = parsed.data;
    const updated = await prisma.trend.update({
      where: { id },
      data: {
        status: data.status,
        expiresAt:
          data.expiresAt === undefined
            ? undefined
            : data.expiresAt === null
              ? null
              : new Date(data.expiresAt),
        platforms: data.platforms,
        name: data.name?.trim(),
        description:
          data.description === undefined
            ? undefined
            : data.description === null
              ? null
              : data.description.trim(),
      },
    });
    return NextResponse.json({ trend: updated });
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
    const trend = await loadInProject(id, project.id);
    if (!trend) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    await prisma.trend.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
