import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

// POST /api/suggestions/<id>/accept
// Trasforma un Suggestion in Draft.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const suggestion = await prisma.suggestion.findUnique({ where: { id } });
  if (!suggestion || suggestion.userId !== session.user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (suggestion.status !== "PROPOSED") {
    return NextResponse.json({ error: "already handled" }, { status: 400 });
  }

  const scheduledFor = suggestion.suggestedTime
    ? combineDateAndTime(suggestion.forDate, suggestion.suggestedTime)
    : suggestion.forDate;

  const draft = await prisma.$transaction(async (tx) => {
    const d = await tx.draft.create({
      data: {
        userId: suggestion.userId,
        suggestionId: suggestion.id,
        platform: suggestion.platform,
        contentType: suggestion.contentType,
        scheduledFor,
        caption: suggestion.caption,
        hashtags: suggestion.hashtags,
        mediaNotes: suggestion.hook,
      },
    });
    await tx.suggestion.update({
      where: { id: suggestion.id },
      data: { status: "ACCEPTED" },
    });
    return d;
  });

  return NextResponse.json({ ok: true, draftId: draft.id });
}

function combineDateAndTime(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(date);
  d.setUTCHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}
