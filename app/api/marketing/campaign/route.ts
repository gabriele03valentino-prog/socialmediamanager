import type { CampaignType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { generateCampaign } from "@/lib/ai/marketing/campaign";
import { prisma } from "@/lib/db";

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
  const input = parsed.data;

  const userId = session.user.id;
  const [profile, personas] = await Promise.all([
    prisma.artistProfile.findUnique({ where: { userId } }),
    prisma.persona.findMany({ where: { userId } }),
  ]);
  if (!profile) {
    return NextResponse.json({ error: "artist_profile_missing" }, { status: 400 });
  }

  try {
    const steps = await generateCampaign({
      title: input.title,
      type: input.type,
      releaseDate: input.releaseDate,
      preSaveUrl: input.preSaveUrl || undefined,
      goal: input.goal,
      artist: {
        stageName: profile.stageName,
        genre: profile.genre,
        city: profile.city,
      },
      personas: personas.map((p) => ({
        name: p.name,
        triggers: Array.isArray(p.triggers) ? (p.triggers as string[]) : [],
        platforms: p.platforms,
      })),
    });

    const campaign = await prisma.campaign.create({
      data: {
        userId,
        title: input.title,
        type: TYPE_MAP[input.type]!,
        releaseDate: new Date(`${input.releaseDate}T00:00:00Z`),
        preSaveUrl: input.preSaveUrl || null,
        goal: input.goal,
        generatedBy: "claude-sonnet-4-6",
        suggestions: {
          create: steps.map((s) => ({
            userId,
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
}
