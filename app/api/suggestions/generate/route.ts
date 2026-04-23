import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateWeeklyPlan } from "@/lib/ai/recommender";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const count = await generateWeeklyPlan(session.user.id);
    return NextResponse.json({ ok: true, created: count });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
