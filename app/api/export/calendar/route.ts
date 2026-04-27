import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { buildICalendar } from "@/lib/export";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Costant-time string comparison per evitare timing attacks sul token feed.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
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
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const providedKey = url.searchParams.get("key");
  const expectedKey = process.env.CALENDAR_FEED_KEY;
  const ownerId = process.env.CALENDAR_FEED_OWNER_ID;

  let userId: string | undefined;
  if (
    providedKey &&
    expectedKey &&
    ownerId &&
    timingSafeEqual(providedKey, expectedKey)
  ) {
    userId = ownerId;
  } else {
    const session = await auth();
    userId = session?.user?.id;
  }

  if (!userId) {
    return new Response("unauthorized", { status: 401 });
  }

  const [drafts, suggestions] = await Promise.all([
    prisma.draft.findMany({
      where: { userId, scheduledFor: { not: null } },
      orderBy: { scheduledFor: "asc" },
    }),
    prisma.suggestion.findMany({
      where: { userId, status: "PROPOSED" },
      orderBy: { forDate: "asc" },
    }),
  ]);

  const ics = buildICalendar({
    drafts,
    suggestions,
    appUrl: process.env.NEXTAUTH_URL ?? "https://localhost:3000",
  });

  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `inline; filename="smm-studio.ics"`,
      "cache-control": "private, max-age=300",
    },
  });
}
