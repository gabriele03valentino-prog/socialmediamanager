// OAuth TikTok for Developers (v2). Login Kit + Display API.
// Docs: https://developers.tiktok.com/doc/login-kit-web

export const TIKTOK_SCOPES = [
  "user.info.basic",
  "user.info.stats",
  "user.info.profile",
  "video.list",
] as const;

export const TIKTOK_AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
export const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
export const TIKTOK_API_BASE = "https://open.tiktokapis.com/v2";

export function authorizeUrl(params: {
  clientKey: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(TIKTOK_AUTH_URL);
  url.searchParams.set("client_key", params.clientKey);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", TIKTOK_SCOPES.join(","));
  return url.toString();
}

export interface TiktokTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // secondi (~24h per access, più lungo per refresh)
  refresh_expires_in: number;
  open_id: string;
  scope: string;
  token_type: "Bearer";
}

async function postTokenRequest(
  body: URLSearchParams,
): Promise<TiktokTokenResponse> {
  const res = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "cache-control": "no-cache",
    },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`TikTok token endpoint: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as TiktokTokenResponse & { error?: string };
  if (json.error) {
    throw new Error(`TikTok token error: ${json.error}`);
  }
  return json;
}

export async function exchangeCodeForTokens(args: {
  code: string;
  redirectUri: string;
  clientKey: string;
  clientSecret: string;
}): Promise<TiktokTokenResponse> {
  const body = new URLSearchParams({
    client_key: args.clientKey,
    client_secret: args.clientSecret,
    code: args.code,
    grant_type: "authorization_code",
    redirect_uri: args.redirectUri,
  });
  return postTokenRequest(body);
}

export async function refreshAccessToken(args: {
  refreshToken: string;
  clientKey: string;
  clientSecret: string;
}): Promise<TiktokTokenResponse> {
  const body = new URLSearchParams({
    client_key: args.clientKey,
    client_secret: args.clientSecret,
    grant_type: "refresh_token",
    refresh_token: args.refreshToken,
  });
  return postTokenRequest(body);
}

export interface TiktokUserInfo {
  openId: string;
  displayName: string;
  username?: string;
  followerCount?: number;
  followingCount?: number;
  likesCount?: number;
  videoCount?: number;
  bio?: string;
  avatarUrl?: string;
}

export async function fetchUserInfo(accessToken: string): Promise<TiktokUserInfo> {
  const fields = [
    "open_id",
    "union_id",
    "display_name",
    "username",
    "bio_description",
    "avatar_url",
    "follower_count",
    "following_count",
    "likes_count",
    "video_count",
  ].join(",");
  const res = await fetch(`${TIKTOK_API_BASE}/user/info/?fields=${fields}`, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`TikTok user/info: ${res.status} ${await res.text()}`);
  }
  type Raw = {
    data?: {
      user?: {
        open_id: string;
        display_name: string;
        username?: string;
        bio_description?: string;
        avatar_url?: string;
        follower_count?: number;
        following_count?: number;
        likes_count?: number;
        video_count?: number;
      };
    };
  };
  const json = (await res.json()) as Raw;
  const u = json.data?.user;
  if (!u) throw new Error("TikTok user/info: risposta senza user");
  return {
    openId: u.open_id,
    displayName: u.display_name,
    username: u.username,
    followerCount: u.follower_count,
    followingCount: u.following_count,
    likesCount: u.likes_count,
    videoCount: u.video_count,
    bio: u.bio_description,
    avatarUrl: u.avatar_url,
  };
}
