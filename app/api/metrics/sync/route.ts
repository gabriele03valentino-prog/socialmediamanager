import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { withProjectRoute } from "@/lib/active-project";
import { syncProjectAccounts } from "@/lib/sync";

// POST /api/metrics/sync                  → sincronizza tutti gli account del project attivo
// POST /api/metrics/sync?accountId=...    → solo lo specifico account (sempre filtrato per project)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return withProjectRoute(req, async (project) => {
    const url = new URL(req.url);
    const accountId = url.searchParams.get("accountId") ?? undefined;

    const results = await syncProjectAccounts(project.id, { accountId });
    return NextResponse.json({ ok: true, results });
  });
}
