import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { withProjectRoute } from "@/lib/active-project";
import { prisma } from "@/lib/db";

const UpdateSchema = z.object({
  caption: z.string().min(1).max(5000).optional(),
  hashtags: z.array(z.string()).max(30).optional(),
  scheduledFor: z.string().datetime().optional(),
  status: z.enum(["TODO", "READY", "PUBLISHED", "ARCHIVED"]).optional(),
  mediaNotes: z.string().max(4000).optional(),
});

async function loadInProject(id: string, projectId: string) {
  const d = await prisma.draft.findUnique({ where: { id } });
  if (!d || d.projectId !== projectId) return null;
  return d;
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
    const draft = await loadInProject(id, project.id);
    if (!draft) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const data = parsed.data;
    const updated = await prisma.draft.update({
      where: { id },
      data: {
        caption: data.caption,
        hashtags: data.hashtags,
        scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : undefined,
        status: data.status,
        mediaNotes: data.mediaNotes,
      },
    });
    return NextResponse.json({ ok: true, draft: updated });
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
    const draft = await loadInProject(id, project.id);
    if (!draft) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await prisma.draft.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
