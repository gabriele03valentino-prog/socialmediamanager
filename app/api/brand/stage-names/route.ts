import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { withProjectRoute } from "@/lib/active-project";
import {
  proposeStageNames,
  StageNameInputSchema,
} from "@/lib/ai/brand/stage-name";
import { prisma } from "@/lib/db";
import { checkHandle } from "@/lib/handle-check";
import { LIMITS, rateLimitOrResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const Body = StageNameInputSchema.partial({ language: true, count: true });

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

  return withProjectRoute(req, async (project) => {
    const limited = rateLimitOrResponse(
      userId,
      "brand.stage-names",
      LIMITS.brandStageNames,
      project.id,
    );
    if (limited) return limited;
    const input = {
      project: {
        id: project.id,
        kind: project.kind,
        displayName: project.displayName,
        niche: project.niche,
        city: project.city,
        bio: project.bio,
      },
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
            projectId: project.id,
            name: p.name,
            rationale: p.rationale,
            availability: (p.availability ?? null) as never,
          },
        }),
      ),
    );

    return NextResponse.json({ ok: true, ideas: created });
  });
}
