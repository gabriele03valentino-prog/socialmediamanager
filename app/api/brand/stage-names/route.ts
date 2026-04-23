import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import {
  proposeStageNames,
  StageNameInputSchema,
} from "@/lib/ai/brand/stage-name";
import { prisma } from "@/lib/db";
import { checkHandle } from "@/lib/handle-check";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const Body = StageNameInputSchema.partial({ language: true, count: true });

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

  // Completa default da profilo se mancanti.
  const profile = await prisma.artistProfile.findUnique({
    where: { userId: session.user.id },
  });
  const input = {
    genre: parsed.data.genre || profile?.genre || "non specificato",
    city: parsed.data.city || profile?.city || undefined,
    keywords: parsed.data.keywords,
    initials: parsed.data.initials,
    language: parsed.data.language ?? "misto",
    count: parsed.data.count ?? 12,
  };

  const proposals = await proposeStageNames(input);

  // Check disponibilità solo per i primi 6 per non saturare i rate limit.
  const topForCheck = proposals.slice(0, 6);
  const results = await Promise.all(
    topForCheck.map(async (p) => ({
      ...p,
      availability: await checkHandle(p.name),
    })),
  );
  const rest = proposals.slice(6).map((p) => ({
    ...p,
    availability: null as never,
  }));

  // Persist candidates.
  const created = await prisma.$transaction(
    [...results, ...rest].map((p) =>
      prisma.stageNameIdea.create({
        data: {
          userId: session.user.id!,
          name: p.name,
          rationale: p.rationale,
          availability: (p.availability ?? null) as never,
        },
      }),
    ),
  );

  return NextResponse.json({ ok: true, ideas: created });
}
