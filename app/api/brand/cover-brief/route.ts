import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { CoverInputSchema, generateCoverBrief } from "@/lib/ai/brand/cover";
import { prisma } from "@/lib/db";
import { LIMITS, rateLimitOrResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const Body = CoverInputSchema.omit({ palette: true, moodKeywordsBrand: true });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const limited = rateLimitOrResponse(
    session.user.id,
    "brand.cover-brief",
    LIMITS.brandCoverBrief,
  );
  if (limited) return limited;

  const body = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const brand = await prisma.brandIdentity.findUnique({
    where: { userId: session.user.id },
  });

  type PaletteItem = { hex?: string };
  const paletteArr = Array.isArray(brand?.palette)
    ? (brand?.palette as unknown as PaletteItem[])
    : [];
  const paletteHex = paletteArr
    .map((c) => c?.hex)
    .filter((h): h is string => typeof h === "string")
    .slice(0, 6);

  try {
    const brief = await generateCoverBrief({
      ...parsed.data,
      palette: paletteHex,
      moodKeywordsBrand: brand?.moodKeywords ?? [],
    });

    // Append alla lista covers esistente
    const existing = Array.isArray(brand?.coverBriefs)
      ? (brand!.coverBriefs as unknown as object[])
      : [];
    const coverBriefs = [
      { ...brief, createdAt: new Date().toISOString() },
      ...existing,
    ].slice(0, 20); // conserviamo le ultime 20

    await prisma.brandIdentity.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        moodKeywords: [],
        coverBriefs: coverBriefs as never,
      },
      update: { coverBriefs: coverBriefs as never },
    });

    return NextResponse.json({ ok: true, brief });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
