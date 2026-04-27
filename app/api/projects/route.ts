import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canCreateProject, MAX_PROJECTS_PER_USER } from "@/lib/projects";
import { CreatorKind } from "@prisma/client";

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
  websiteUrl: z.string().url().optional().nullable().or(z.literal("")),
});

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

  // TOCTOU mitigation: check + create in transaction with re-check
  try {
    const project = await prisma.$transaction(async (tx) => {
      const allowed = await canCreateProject(userId);
      if (!allowed) {
        throw new Error("CAP_REACHED");
      }
      // Re-count inside tx for safety
      const count = await tx.project.count({ where: { userId } });
      // The allowlist bypass already passed canCreateProject; re-count only enforces non-allowlisted users
      const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true } });
      const isAllowlisted = (() => {
        if (!user?.email) return false;
        const raw = process.env.EMAIL_ALLOWLIST;
        if (!raw) return false;
        const norm = user.email.trim().toLowerCase();
        return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).includes(norm);
      })();
      if (!isAllowlisted && count >= MAX_PROJECTS_PER_USER) {
        throw new Error("CAP_REACHED");
      }
      return tx.project.create({
        data: {
          userId,
          kind: parsed.data.kind,
          displayName: parsed.data.displayName,
          niche: parsed.data.niche || null,
          city: parsed.data.city || null,
          bio: parsed.data.bio || null,
          websiteUrl: parsed.data.websiteUrl || null,
        },
      });
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    if ((err as Error).message === "CAP_REACHED") {
      return NextResponse.json(
        { error: "max_projects_reached", limit: MAX_PROJECTS_PER_USER },
        { status: 403 },
      );
    }
    throw err;
  }
}
