import { auth } from "@/auth";
import { getActiveProject } from "@/lib/active-project";
import { prisma } from "@/lib/db";
import { buildICalendar } from "@/lib/export";
import type { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Costant-time check sul token feed (L-4): usa node:crypto.timingSafeEqual
 * (battle-tested) invece di un confronto handrolled. Length-check upfront
 * perché timingSafeEqual lancia se i buffer hanno dimensioni diverse.
 */
function isValidFeedKey(key: string | null, expected: string | undefined): boolean {
  if (!key || !expected) return false;
  if (key.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(key, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}

/**
 * Feed iCalendar (RFC 5545) con bozze schedulate + suggerimenti pendenti.
 *
 * Autenticazione: di default richiede sessione utente. Per sottoscriverlo come
 * feed live in Google/Apple Calendar imposta entrambe le env vars:
 *   - `CALENDAR_FEED_KEY`     token statico (32 char random)
 *   - `CALENDAR_FEED_OWNER_ID` userId hardcoded autorizzato a leggere
 * e poi sottoscrivi `…/api/export/calendar?key=<CALENDAR_FEED_KEY>`.
 *
 * NON accettiamo `userId` come parametro per evitare IDOR: chiunque conoscesse
 * la key potrebbe passare un id arbitrario e scaricare calendari altrui.
 *
 * Multi-progetto (M16): la key resta legata a un singolo userId. Per scegliere
 * il progetto si può passare `?projectId=<id>` (deve appartenere a quell'utente);
 * se assente si usa il primo progetto in ordine di creazione (default sicuro).
 * Senza progetto disponibile → 404.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const providedKey = url.searchParams.get("key");
  const expectedKey = process.env.CALENDAR_FEED_KEY;
  const ownerId = process.env.CALENDAR_FEED_OWNER_ID;
  const requestedProjectId = url.searchParams.get("projectId");

  let userId: string | undefined;
  let usingFeedKey = false;
  if (ownerId && isValidFeedKey(providedKey, expectedKey)) {
    userId = ownerId;
    usingFeedKey = true;
  } else {
    const session = await auth();
    userId = session?.user?.id;
  }

  if (!userId) {
    return new Response("unauthorized", { status: 401 });
  }

  // Risolvi il progetto: se passato esplicitamente verifica appartenenza,
  // altrimenti default = primo progetto dell'utente.
  let project: { id: string; displayName: string } | null = null;
  if (requestedProjectId) {
    const found = await prisma.project.findUnique({
      where: { id: requestedProjectId },
      select: { id: true, displayName: true, userId: true },
    });
    if (!found || found.userId !== userId) {
      return new Response("project_not_found", { status: 404 });
    }
    project = { id: found.id, displayName: found.displayName };
  } else if (usingFeedKey) {
    // Feed-key flow: non c'è cookie attivo → primo progetto dell'utente.
    const first = await prisma.project.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, displayName: true },
    });
    project = first;
  } else {
    // Sessione utente: rispetta il cookie active_project_id, fallback al primo.
    const active = await getActiveProject(req);
    if (active) {
      project = { id: active.id, displayName: active.displayName };
    }
  }

  if (!project) {
    return new Response("no_project", { status: 404 });
  }

  const [drafts, suggestions] = await Promise.all([
    prisma.draft.findMany({
      where: { projectId: project.id, scheduledFor: { not: null } },
      orderBy: { scheduledFor: "asc" },
    }),
    prisma.suggestion.findMany({
      where: { projectId: project.id, status: "PROPOSED" },
      orderBy: { forDate: "asc" },
    }),
  ]);

  const ics = buildICalendar({
    drafts,
    suggestions,
    appUrl: process.env.NEXTAUTH_URL ?? "https://localhost:3000",
    projectLabel: project.displayName,
  });

  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `inline; filename="smm-studio.ics"`,
      "cache-control": "private, max-age=300",
    },
  });
}
