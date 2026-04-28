import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Platform, TrendKind, TrendStatus } from "@prisma/client";
import { auth } from "@/auth";
import { withProjectRoute } from "@/lib/active-project";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateBody = z
  .object({
    kind: z.nativeEnum(TrendKind),
    name: z.string().min(1).max(120),
    description: z.string().max(500).optional().nullable(),
    sourceUrl: z.string().url().max(500).optional().nullable(),
    platforms: z.array(z.nativeEnum(Platform)).min(1),
    status: z.nativeEnum(TrendStatus).optional(),
    expiresAt: z.string().datetime().optional().nullable(),
  })
  .strict();

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return withProjectRoute(req, async (project) => {
    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    const kindParam = url.searchParams.get("kind");

    const where: {
      projectId: string;
      status?: TrendStatus;
      kind?: TrendKind;
    } = { projectId: project.id };

    if (statusParam) {
      const s = statusParam.toUpperCase();
      if (s === "ACTIVE" || s === "WARMING" || s === "EXPIRED") {
        where.status = s as TrendStatus;
      }
    }
    if (kindParam) {
      const k = kindParam.toUpperCase();
      if (k in TrendKind) {
        where.kind = k as TrendKind;
      }
    }

    const trends = await prisma.trend.findMany({
      where,
      orderBy: [{ status: "asc" }, { notedAt: "desc" }],
      take: 200,
    });
    return NextResponse.json({ trends });
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return withProjectRoute(req, async (project) => {
    const json = await req.json().catch(() => null);
    const parsed = CreateBody.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const data = parsed.data;
    const trend = await prisma.trend.create({
      data: {
        projectId: project.id,
        kind: data.kind,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        sourceUrl: data.sourceUrl?.trim() || null,
        platforms: data.platforms,
        status: data.status ?? "ACTIVE",
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        generatedBy: "manual",
      },
    });
    return NextResponse.json({ trend }, { status: 201 });
  });
}
