import type { CampaignType } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { withProjectRoute } from "@/lib/active-project";
import { generateCampaign } from "@/lib/ai/marketing/campaign";
import { prisma } from "@/lib/db";
import { KIND_CAMPAIGN_TYPES } from "@/lib/kind-labels";
import { LIMITS, rateLimitOrResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(["singolo", "ep", "album", "live", "merch"]),
  releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preSaveUrl: z.string().url().optional().or(z.literal("")),
  goal: z.string().max(500).optional(),
});

const TYPE_MAP: Record<string, CampaignType> = {
  singolo: "SINGOLO",
  ep: "EP",
  album: "ALBUM",
  live: "LIVE",
  merch: "MERCH",
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const body = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const input = parsed.data;
  const mappedType = TYPE_MAP[input.type]!;

  return withProjectRoute(req, async (project) => {
    const limited = rateLimitOrResponse(
      userId,
      "marketing.campaign",
      LIMITS.marketingCampaign,
      project.id,
    );
    if (limited) return limited;
    const availableTypes = KIND_CAMPAIGN_TYPES[project.kind];
    if (!availableTypes.includes(mappedType)) {
      return NextResponse.json(
        {
          error: "campaign_type_not_supported_for_kind",
          message: `Campagna "${input.type}" non valida per kind ${project.kind}`,
        },
        { status: 400 },
      );
    }

    const personas = await prisma.persona.findMany({
      where: { projectId: project.id },
    });

    try {
      const steps = await generateCampaign({
        project: {
          id: project.id,
          kind: project.kind,
          displayName: project.displayName,
          niche: project.niche,
          city: project.city,
          bio: project.bio,
        },
        title: input.title,
        type: mappedType,
        availableTypes,
        releaseDate: input.releaseDate,
        preSaveUrl: input.preSaveUrl || undefined,
        goal: input.goal,
        personas: personas.map((p) => ({
          name: p.name,
          triggers: Array.isArray(p.triggers) ? (p.triggers as string[]) : [],
          platforms: p.platforms,
        })),
      });

      const campaign = await prisma.campaign.create({
        data: {
          projectId: project.id,
          title: input.title,
          type: mappedType,
          releaseDate: new Date(`${input.releaseDate}T00:00:00Z`),
          preSaveUrl: input.preSaveUrl || null,
          goal: input.goal,
          generatedBy: "claude-sonnet-4-6",
          suggestions: {
            create: steps.map((s) => ({
              projectId: project.id,
              forDate: new Date(`${s.forDate}T00:00:00Z`),
              platform: s.platform,
              contentType: s.contentType,
              hook: s.hook,
              caption: s.caption,
              hashtags: s.hashtags,
              cta: s.cta,
              suggestedTime: s.suggestedTime,
              rationale: `[${s.phase.toUpperCase()}] ${s.rationale}`,
              generatedBy: "claude-sonnet-4-6",
            })),
          },
        },
        include: { suggestions: true },
      });

      return NextResponse.json({
        ok: true,
        campaignId: campaign.id,
        steps: campaign.suggestions.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
