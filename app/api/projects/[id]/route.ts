import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { CreatorKind } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UpdateBody = z.object({
  kind: z.nativeEnum(CreatorKind).optional(),
  displayName: z.string().min(1).max(80).optional(),
  niche: z.string().max(80).nullable().optional(),
  city: z.string().max(80).nullable().optional(),
  bio: z.string().max(2000).nullable().optional(),
  websiteUrl: z.string().url().max(300).nullable().optional().or(z.literal("")),
  emailFeedbackEnabled: z.boolean().optional(),
}).strict();

async function ownProject(userId: string, projectId: string) {
  const proj = await prisma.project.findUnique({ where: { id: projectId } });
  if (!proj || proj.userId !== userId) return null;
  return proj;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const proj = await ownProject(session.user.id, id);
  if (!proj) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = UpdateBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v === "") data[k] = null;
    else if (typeof v === "string") data[k] = v.trim() || null;
    else data[k] = v;
  }

  const updated = await prisma.project.update({ where: { id }, data });
  return NextResponse.json({ project: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const proj = await ownProject(session.user.id, id);
  if (!proj) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
