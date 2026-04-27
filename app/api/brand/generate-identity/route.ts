import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { withProjectRoute } from "@/lib/active-project";
import { generateBrandIdentity } from "@/lib/ai/brand/identity";
import { prisma } from "@/lib/db";
import { LIMITS, rateLimitOrResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 90;

const Body = z.object({
  moodKeywords: z.array(z.string()).max(10).optional(),
  referenceArtists: z.array(z.string()).max(5).optional(),
  favoriteColors: z.array(z.string()).max(5).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const limited = rateLimitOrResponse(
    session.user.id,
    "brand.identity",
    LIMITS.brandIdentity,
  );
  if (limited) return limited;

  const body = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  return withProjectRoute(req, async (project) => {
    try {
      const identity = await generateBrandIdentity({
        project: {
          id: project.id,
          kind: project.kind,
          displayName: project.displayName,
          niche: project.niche,
          city: project.city,
          bio: project.bio,
        },
        moodKeywords: parsed.data.moodKeywords ?? [],
        referenceArtists: parsed.data.referenceArtists ?? [],
        favoriteColors: parsed.data.favoriteColors ?? [],
      });

      const saved = await prisma.brandIdentity.upsert({
        where: { projectId: project.id },
        create: {
          projectId: project.id,
          palette: identity.palette as never,
          typography: identity.typography as never,
          toneOfVoice: identity.toneOfVoice as never,
          moodKeywords: identity.moodKeywords,
          logoBrief: identity.logoBrief,
          logoSvg: identity.logoSvg,
          claudeDesignPrompt: identity.claudeDesignPrompt,
          mjPrompt: identity.mjPrompt,
        },
        update: {
          palette: identity.palette as never,
          typography: identity.typography as never,
          toneOfVoice: identity.toneOfVoice as never,
          moodKeywords: identity.moodKeywords,
          logoBrief: identity.logoBrief,
          logoSvg: identity.logoSvg,
          claudeDesignPrompt: identity.claudeDesignPrompt,
          mjPrompt: identity.mjPrompt,
        },
      });

      return NextResponse.json({ ok: true, identity: saved });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
