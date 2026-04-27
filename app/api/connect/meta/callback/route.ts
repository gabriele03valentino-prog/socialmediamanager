import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { verifyOAuthState } from "@/lib/active-project";
import { encryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import {
  exchangeCodeForToken,
  exchangeForLongLived,
  fetchPages,
} from "@/lib/platforms/meta-oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  // Stato firmato HMAC: estrae projectId in modo tamper-proof.
  const decoded = verifyOAuthState(state);
  if (!decoded || !decoded.userId || !decoded.projectId) {
    return redirectToSettings(url, { error: "state_mismatch" });
  }
  if (decoded.userId !== session.user.id) {
    return redirectToSettings(url, { error: "state_mismatch" });
  }

  // Difensivo: verifica che il project esista e appartenga davvero all'utente.
  const project = await prisma.project.findUnique({
    where: { id: decoded.projectId },
  });
  if (!project || project.userId !== session.user.id) {
    return redirectToSettings(url, { error: "project_not_owned" });
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
          projectId_platform_externalId: {
            projectId: project.id,
            platform: "FACEBOOK",
            externalId: page.id,
          },
        },
        create: {
          projectId: project.id,
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
            projectId_platform_externalId: {
              projectId: project.id,
              platform: "INSTAGRAM",
              externalId: ig.id,
            },
          },
          create: {
            projectId: project.id,
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
  return NextResponse.redirect(target);
}
