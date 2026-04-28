import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canCreateProject, MAX_PROJECTS_PER_USER } from "@/lib/projects";
import { CreatorKind } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      kind: true,
      displayName: true,
      niche: true,
      city: true,
      emailFeedbackEnabled: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ projects });
}

const CreateBody = z.object({
  kind: z.nativeEnum(CreatorKind),
  displayName: z.string().min(1).max(80),
  niche: z.string().max(80).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
  websiteUrl: z.string().url().max(300).optional().nullable().or(z.literal("")),
}).strict();

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const json = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Soft cap: enforced by server-side check, but two concurrent POSTs at
  // count=N-1 can both pass and end at N+1. Acceptable for M16 (low
  // concurrency, single-owner accounts). Strict enforcement would require
  // Serializable isolation + retry, or a row-level lock — overkill here.
  if (!(await canCreateProject(userId))) {
    return NextResponse.json(
      { error: "max_projects_reached", limit: MAX_PROJECTS_PER_USER },
      { status: 403 },
    );
  }

  const project = await prisma.project.create({
    data: {
      userId,
      kind: parsed.data.kind,
      displayName: parsed.data.displayName.trim(),
      niche: parsed.data.niche?.trim() || null,
      city: parsed.data.city?.trim() || null,
      bio: parsed.data.bio?.trim() || null,
      websiteUrl: parsed.data.websiteUrl?.trim() || null,
    },
  });

  return NextResponse.json({ project }, { status: 201 });
}
