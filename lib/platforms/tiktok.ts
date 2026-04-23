// TikTok Display API. Schema SocialAccount:
//   externalId       = open_id TikTok
//   accessTokenEnc   = access token (~24h)
//   refreshTokenEnc  = refresh token (~365g)
//   expiresAt        = scadenza access
//   meta             = { username, displayName, avatarUrl? }

import type { SocialAccount } from "@prisma/client";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import type { PlatformAdapter, PostResult } from "./adapter";
import { fetchUserInfo, refreshAccessToken, TIKTOK_API_BASE } from "./tiktok-oauth";

async function getValidAccessToken(account: SocialAccount): Promise<string> {
  const expiresAt = account.expiresAt?.getTime();
  const safeNow = Date.now() + 60_000;
  if (expiresAt && expiresAt > safeNow) {
    return decryptToken(account.accessTokenEnc);
  }
  if (!account.refreshTokenEnc) {
    throw new Error("TikTok: refresh token mancante. Riconnetti l'account.");
  }
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    throw new Error("TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET non configurati");
  }
  const refreshed = await refreshAccessToken({
    refreshToken: decryptToken(account.refreshTokenEnc),
    clientKey,
    clientSecret,
  });
  await prisma.socialAccount.update({
    where: { id: account.id },
    data: {
      accessTokenEnc: encryptToken(refreshed.access_token),
      refreshTokenEnc: encryptToken(refreshed.refresh_token),
      expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
    },
  });
  return refreshed.access_token;
}

interface TiktokVideo {
  id: string;
  create_time: number; // unix seconds
  cover_image_url?: string;
  share_url?: string;
  video_description?: string;
  duration?: number;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
}

async function fetchVideoList(
  accessToken: string,
  max = 20,
): Promise<TiktokVideo[]> {
  const fields = [
    "id",
    "create_time",
    "cover_image_url",
    "share_url",
    "video_description",
    "duration",
    "view_count",
    "like_count",
    "comment_count",
    "share_count",
  ].join(",");

  const res = await fetch(`${TIKTOK_API_BASE}/video/list/?fields=${fields}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ max_count: max }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`TikTok video/list: ${res.status} ${await res.text()}`);
  }
  type Raw = {
    data?: { videos?: TiktokVideo[] };
  };
  const json = (await res.json()) as Raw;
  return json.data?.videos ?? [];
}

export const tiktokAdapter: PlatformAdapter = {
  platform: "TIKTOK",

  async syncMetrics(account) {
    const token = await getValidAccessToken(account);
    const info = await fetchUserInfo(token);
    return {
      followers: info.followerCount,
      following: info.followingCount,
      postsCount: info.videoCount,
      extra: {
        totalLikes: info.likesCount,
      },
    };
  },

  async syncRecentPosts(account) {
    const token = await getValidAccessToken(account);
    const videos = await fetchVideoList(token, 20);
    const posts: PostResult[] = videos.map((v) => ({
      externalId: v.id,
      postedAt: new Date(v.create_time * 1000),
      mediaType: "TIKTOK" as unknown as PostResult["mediaType"],
      caption: v.video_description,
      permalink: v.share_url,
      likes: v.like_count,
      comments: v.comment_count,
      shares: v.share_count,
      views: v.view_count,
      raw: v as unknown as Record<string, unknown>,
    }));
    // MediaType enum Prisma non ha "TIKTOK" → mappiamo in VIDEO.
    for (const p of posts) p.mediaType = "VIDEO";
    return posts;
  },

  async syncAudience() {
    // TikTok Display API non espone la demografica dell'audience.
    // La Research API lo farebbe ma richiede approvazione accademica.
    return null;
  },
};
