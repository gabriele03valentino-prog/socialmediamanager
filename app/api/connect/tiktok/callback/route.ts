import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { verifyOAuthState } from "@/lib/active-project";
import { encryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import {
  exchangeCodeForTokens,
  fetchUserInfo,
  TIKTOK_SCOPES,
} from "@/lib/platforms/tiktok-oauth";

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

  if (error) return redirectToSettings(url, { error });
  if (!code || !state) return redirectToSettings(url, { error: "missing_code" });

  const decoded = verifyOAuthState(state);
  if (!decoded || !decoded.userId || !decoded.projectId) {
    return redirectToSettings(url, { error: "state_mismatch" });
  }
  if (decoded.userId !== session.user.id) {
    return redirectToSettings(url, { error: "state_mismatch" });
  }

  const project = await prisma.project.findUnique({
    where: { id: decoded.projectId },
  });
  if (!project || project.userId !== session.user.id) {
    return redirectToSettings(url, { error: "project_not_owned" });
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    return redirectToSettings(url, { error: "tiktok_credentials_missing" });
  }
  const redirectUri = `${url.origin}/api/connect/tiktok/callback`;

  try {
    const tokens = await exchangeCodeForTokens({
      code,
      redirectUri,
      clientKey,
      clientSecret,
    });
    const info = await fetchUserInfo(tokens.access_token);

    await prisma.socialAccount.upsert({
      where: {
        projectId_platform_externalId: {
          projectId: project.id,
          platform: "TIKTOK",
          externalId: tokens.open_id,
        },
      },
      create: {
        projectId: project.id,
        platform: "TIKTOK",
        handle: info.username ? `@${info.username}` : info.displayName,
        externalId: tokens.open_id,
        accessTokenEnc: encryptToken(tokens.access_token),
        refreshTokenEnc: encryptToken(tokens.refresh_token),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scopes: [...TIKTOK_SCOPES],
        meta: {
          displayName: info.displayName,
          username: info.username,
          avatarUrl: info.avatarUrl,
        },
      },
      update: {
        handle: info.username ? `@${info.username}` : info.displayName,
        accessTokenEnc: encryptToken(tokens.access_token),
        refreshTokenEnc: encryptToken(tokens.refresh_token),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        meta: {
          displayName: info.displayName,
          username: info.username,
          avatarUrl: info.avatarUrl,
        },
        lastSyncError: null,
      },
    });

    return redirectTo(url, safeNext(decoded.next), {
      connected: "tiktok",
      handle: info.username ?? info.displayName,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return redirectToSettings(url, { error: "oauth_failed", message });
  }
}

function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") ? next : "/impostazioni";
}

function redirectTo(
  base: URL,
  path: string,
  params: Record<string, string>,
): NextResponse {
  const target = new URL(path, base.origin);
  for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v);
  return NextResponse.redirect(target);
}

function redirectToSettings(
  base: URL,
  params: Record<string, string>,
): NextResponse {
  return redirectTo(base, "/impostazioni", params);
}
