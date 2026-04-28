import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { withProjectRoute } from "@/lib/active-project";
import { prisma } from "@/lib/db";
import { draftsToCsv } from "@/lib/export";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return withProjectRoute(req, async (project) => {
    const url = new URL(req.url);
    const format = (url.searchParams.get("format") ?? "csv").toLowerCase();

    const drafts = await prisma.draft.findMany({
      where: { projectId: project.id },
      orderBy: [{ scheduledFor: "asc" }, { updatedAt: "desc" }],
    });

    if (format === "json") {
      return NextResponse.json({ ok: true, drafts });
    }

    const csv = draftsToCsv(drafts);
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="bozze-${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
      },
    });
  });
}
