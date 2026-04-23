import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { encryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import {
  exchangeCodeForTokens,
  fetchOwnedChannel,
  YOUTUBE_SCOPES,
} from "@/lib/platforms/youtube-oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATE_COOKIE = "youtube_oauth_state";

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

  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  if (!clientId || !clientSecret) {
    return redirectToSettings(url, { error: "google_credentials_missing" });
  }
  const redirectUri = `${url.origin}/api/connect/youtube/callback`;

  try {
    const tokens = await exchangeCodeForTokens({
      code,
      redirectUri,
      clientId,
      clientSecret,
    });
    const channel = await fetchOwnedChannel(tokens.access_token);
    if (!channel) {
      return redirectToSettings(url, { error: "no_youtube_channel" });
    }

    if (!tokens.refresh_token) {
      // Rarissimo: Google non ha restituito refresh_token (già concesso in
      // passato senza prompt=consent). Forziamo riconsenso.
      return redirectToSettings(url, { error: "no_refresh_token" });
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.socialAccount.upsert({
      where: {
        userId_platform_externalId: {
          userId: session.user.id,
          platform: "YOUTUBE",
          externalId: channel.id,
        },
      },
      create: {
        userId: session.user.id,
        platform: "YOUTUBE",
        handle: channel.customUrl ?? channel.title,
        externalId: channel.id,
        accessTokenEnc: encryptToken(tokens.access_token),
        refreshTokenEnc: encryptToken(tokens.refresh_token),
        expiresAt,
        scopes: [...YOUTUBE_SCOPES],
        meta: {
          title: channel.title,
          customUrl: channel.customUrl,
          uploadsPlaylistId: channel.uploadsPlaylistId,
        },
      },
      update: {
        handle: channel.customUrl ?? channel.title,
        accessTokenEnc: encryptToken(tokens.access_token),
        refreshTokenEnc: encryptToken(tokens.refresh_token),
        expiresAt,
        meta: {
          title: channel.title,
          customUrl: channel.customUrl,
          uploadsPlaylistId: channel.uploadsPlaylistId,
        },
        lastSyncError: null,
      },
    });

    return redirectToSettings(url, {
      connected: "youtube",
      channel: channel.title,
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
