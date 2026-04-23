import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { encryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import {
  exchangeCodeForToken,
  exchangeForLongLived,
  fetchPages,
} from "@/lib/platforms/meta-oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATE_COOKIE = "meta_oauth_state";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  if (error) {
    return redirectToSettings(url, { error, error_description: errorDescription ?? "" });
  }
  if (!code || !state) {
    return redirectToSettings(url, { error: "missing_code" });
  }

  const cookieStore = await cookies();
  const cookieState = cookieStore.get(STATE_COOKIE)?.value;
  if (!cookieState || cookieState !== state) {
    return redirectToSettings(url, { error: "state_mismatch" });
  }

  const clientId = process.env.META_CLIENT_ID;
  const clientSecret = process.env.META_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return redirectToSettings(url, { error: "meta_credentials_missing" });
  }

  const redirectUri = `${url.origin}/api/connect/meta/callback`;

  try {
    const short = await exchangeCodeForToken({
      code,
      redirectUri,
      clientId,
      clientSecret,
    });
    const long = await exchangeForLongLived({
      shortLivedToken: short.access_token,
      clientId,
      clientSecret,
    });

    const expiresAt = long.expires_in
      ? new Date(Date.now() + long.expires_in * 1000)
      : null;

    const pages = await fetchPages(long.access_token);
    if (pages.length === 0) {
      return redirectToSettings(url, { error: "no_pages" });
    }

    // Per ogni Pagina creiamo un SocialAccount FACEBOOK; se ha un IG
    // Business collegato creiamo anche un SocialAccount INSTAGRAM.
    // Il page token (long-lived, non scade) viene riutilizzato per IG
    // perché l'IG Graph API è gated dal Page che lo possiede.
    for (const page of pages) {
      const pageTokenEnc = encryptToken(page.accessToken);

      await prisma.socialAccount.upsert({
        where: {
          userId_platform_externalId: {
            userId: session.user.id,
            platform: "FACEBOOK",
            externalId: page.id,
          },
        },
        create: {
          userId: session.user.id,
          platform: "FACEBOOK",
          handle: page.name,
          externalId: page.id,
          accessTokenEnc: pageTokenEnc,
          expiresAt,
          scopes: ["pages_show_list", "pages_read_engagement"],
          meta: { pageName: page.name },
        },
        update: {
          handle: page.name,
          accessTokenEnc: pageTokenEnc,
          expiresAt,
          lastSyncError: null,
        },
      });

      if (page.instagramBusinessAccount) {
        const ig = page.instagramBusinessAccount;
        await prisma.socialAccount.upsert({
          where: {
            userId_platform_externalId: {
              userId: session.user.id,
              platform: "INSTAGRAM",
              externalId: ig.id,
            },
          },
          create: {
            userId: session.user.id,
            platform: "INSTAGRAM",
            handle: `@${ig.username}`,
            externalId: ig.id,
            accessTokenEnc: pageTokenEnc,
            expiresAt,
            scopes: ["instagram_basic", "instagram_manage_insights"],
            meta: { pageId: page.id, pageName: page.name, igUsername: ig.username },
          },
          update: {
            handle: `@${ig.username}`,
            accessTokenEnc: pageTokenEnc,
            expiresAt,
            lastSyncError: null,
          },
        });
      }
    }

    const igCount = pages.filter((p) => p.instagramBusinessAccount).length;
    return redirectToSettings(url, {
      connected: "meta",
      pages: String(pages.length),
      instagram: String(igCount),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return redirectToSettings(url, { error: "oauth_failed", message });
  }
}

function redirectToSettings(
  base: URL,
  params: Record<string, string>,
): NextResponse {
  const target = new URL("/impostazioni", base.origin);
  for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v);
  const res = NextResponse.redirect(target);
  res.cookies.delete(STATE_COOKIE);
  return res;
}
