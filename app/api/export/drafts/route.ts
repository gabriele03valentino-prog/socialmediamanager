import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { draftsToCsv } from "@/lib/export";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("unauthorized", { status: 401 });
  }
  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "csv").toLowerCase();

  const drafts = await prisma.draft.findMany({
    where: { userId: session.user.id },
    orderBy: [{ scheduledFor: "asc" }, { updatedAt: "desc" }],
  });

  if (format === "json") {
    return Response.json({ ok: true, drafts });
  }

  const csv = draftsToCsv(drafts);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="bozze-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}
