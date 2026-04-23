import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/brand/stage-names/:id/choose → setta ArtistProfile.stageName
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const idea = await prisma.stageNameIdea.findUnique({ where: { id } });
  if (!idea || idea.userId !== session.user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.stageNameIdea.updateMany({
      where: { userId: session.user.id },
      data: { chosen: false },
    }),
    prisma.stageNameIdea.update({
      where: { id: idea.id },
      data: { chosen: true },
    }),
    prisma.artistProfile.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        stageName: idea.name,
        genre: "non specificato",
      },
      update: {
        stageName: idea.name,
      },
    }),
  ]);

  return NextResponse.json({ ok: true, stageName: idea.name });
}
