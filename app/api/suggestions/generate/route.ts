import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { withProjectRoute } from "@/lib/active-project";
import { generateWeeklyPlan } from "@/lib/ai/recommender";
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
      "suggestions.generate",
      LIMITS.suggestionsGenerate,
      project.id,
    );
    if (limited) return limited;
    try {
      const count = await generateWeeklyPlan(project.id);
      return NextResponse.json({ ok: true, created: count });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
