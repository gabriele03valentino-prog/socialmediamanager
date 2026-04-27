import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { withProjectRoute } from "@/lib/active-project";
import { generatePersonas } from "@/lib/ai/marketing/persona";
import { prisma } from "@/lib/db";
import { LIMITS, rateLimitOrResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  return withProjectRoute(req, async (project) => {
    const limited = rateLimitOrResponse(
      userId,
      "marketing.persona",
      LIMITS.marketingPersona,
      project.id,
    );
    if (limited) return limited;

    const audiences = await prisma.audienceInsight.findMany({
      where: { account: { projectId: project.id } },
      orderBy: { capturedAt: "desc" },
      take: 5,
    });

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
        project: {
          id: project.id,
          kind: project.kind,
          displayName: project.displayName,
          niche: project.niche,
          city: project.city,
          bio: project.bio,
        },
        audienceData,
      });

      // Sostituiamo le vecchie personas con le nuove (tiene coerenza)
      await prisma.$transaction([
        prisma.persona.deleteMany({ where: { projectId: project.id } }),
        ...personas.map((p) =>
          prisma.persona.create({
            data: {
              projectId: project.id,
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
  });
}
