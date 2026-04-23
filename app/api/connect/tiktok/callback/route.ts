import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { encryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import {
  exchangeCodeForTokens,
  fetchUserInfo,
  TIKTOK_SCOPES,
} from "@/lib/platforms/tiktok-oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATE_COOKIE = "tiktok_oauth_state";

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

  const cookieStore = await cookies();
  const cookieState = cookieStore.get(STATE_COOKIE)?.value;
  if (!cookieState || cookieState !== state) {
    return redirectToSettings(url, { error: "state_mismatch" });
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
        userId_platform_externalId: {
          userId: session.user.id,
          platform: "TIKTOK",
          externalId: tokens.open_id,
        },
      },
      create: {
        userId: session.user.id,
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

    return redirectToSettings(url, {
      connected: "tiktok",
      handle: info.username ?? info.displayName,
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
