import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { syncAccount } from "@/lib/sync";

// POST /api/metrics/sync          → sincronizza tutti gli account dell'utente
// POST /api/metrics/sync?accountId → solo uno specifico
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const accountId = url.searchParams.get("accountId");

  const accounts = await prisma.socialAccount.findMany({
    where: accountId
      ? { id: accountId, userId: session.user.id }
      : { userId: session.user.id },
  });

  const results = [];
  for (const a of accounts) {
    const r = await syncAccount(a);
    results.push({ accountId: a.id, platform: a.platform, ...r });
  }

  return NextResponse.json({ ok: true, results });
}
