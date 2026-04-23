import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { generatePersonas } from "@/lib/ai/marketing/persona";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const [profile, audiences] = await Promise.all([
    prisma.artistProfile.findUnique({ where: { userId } }),
    prisma.audienceInsight.findMany({
      where: { account: { userId } },
      orderBy: { capturedAt: "desc" },
      take: 5,
    }),
  ]);

  if (!profile) {
    return NextResponse.json(
      { error: "artist_profile_missing" },
      { status: 400 },
    );
  }

  const audienceData =
    audiences.length > 0
      ? {
          sources: audiences.map((a) => ({
            ageBuckets: a.ageBuckets,
            genderSplit: a.genderSplit,
            topCountries: a.topCountries,
          })),
        }
      : undefined;

  try {
    const personas = await generatePersonas({
      artist: {
        stageName: profile.stageName,
        genre: profile.genre,
        city: profile.city,
        bio: profile.bio,
      },
      audienceData,
      goals: profile.goals ?? undefined,
    });

    // Sostituiamo le vecchie personas con le nuove (tiene coerenza)
    await prisma.$transaction([
      prisma.persona.deleteMany({ where: { userId } }),
      ...personas.map((p) =>
        prisma.persona.create({
          data: {
            userId,
            name: p.name,
            ageRange: p.ageRange,
            location: p.location,
            occupation: p.occupation,
            musicHabits: p.musicHabits,
            platforms: p.platforms,
            listeningTimes: p.listeningTimes,
            triggers: p.triggers as never,
            culturalRefs: p.culturalRefs as never,
            generatedBy: "claude-sonnet-4-6",
          },
        }),
      ),
    ]);

    return NextResponse.json({ ok: true, count: personas.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
