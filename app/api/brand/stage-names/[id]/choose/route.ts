import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { withProjectRoute } from "@/lib/active-project";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/brand/stage-names/:id/choose → setta Project.displayName
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  return withProjectRoute(req, async (project) => {
    const idea = await prisma.stageNameIdea.findUnique({ where: { id } });
    if (!idea || idea.projectId !== project.id) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.stageNameIdea.updateMany({
        where: { projectId: project.id },
        data: { chosen: false },
      }),
      prisma.stageNameIdea.update({
        where: { id: idea.id },
        data: { chosen: true },
      }),
      prisma.project.update({
        where: { id: project.id },
        data: { displayName: idea.name },
      }),
    ]);

    return NextResponse.json({ ok: true, displayName: idea.name });
  });
}
