// OAuth Google per il connettore YouTube. Riusa lo stesso OAuth client del
// login app (AUTH_GOOGLE_ID/SECRET): serve solo aggiungere
// http://localhost:3000/api/connect/youtube/callback nei redirect URI
// e abilitare YouTube Data API v3 + YouTube Analytics API nel progetto Cloud.

export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
] as const;

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export function authorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  url.searchParams.set("scope", YOUTUBE_SCOPES.join(" "));
  url.searchParams.set("response_type", "code");
  // access_type=offline + prompt=consent ci garantiscono un refresh_token
  // anche se l'utente ha già autorizzato in passato.
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  return url.toString();
}

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: "Bearer";
  id_token?: string;
}

export async function exchangeCodeForTokens(args: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code: args.code,
    client_id: args.clientId,
    client_secret: args.clientSecret,
    redirect_uri: args.redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Google token exchange fallito: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as GoogleTokenResponse;
}

export async function refreshAccessToken(args: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    refresh_token: args.refreshToken,
    client_id: args.clientId,
    client_secret: args.clientSecret,
    grant_type: "refresh_token",
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Google refresh fallito: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as GoogleTokenResponse;
}

export interface OwnedChannel {
  id: string;
  title: string;
  customUrl?: string;
  subscriberCount?: number;
  videoCount?: number;
  viewCount?: number;
  uploadsPlaylistId?: string;
}

export async function fetchOwnedChannel(
  accessToken: string,
): Promise<OwnedChannel | null> {
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("mine", "true");
  url.searchParams.set("part", "snippet,statistics,contentDetails");
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`YouTube channels.list fallito: ${res.status} ${await res.text()}`);
  }
  type Raw = {
    items?: Array<{
      id: string;
      snippet: { title: string; customUrl?: string };
      statistics: {
        subscriberCount?: string;
        videoCount?: string;
        viewCount?: string;
      };
      contentDetails: {
        relatedPlaylists?: { uploads?: string };
      };
    }>;
  };
  const json = (await res.json()) as Raw;
  const ch = json.items?.[0];
  if (!ch) return null;
  return {
    id: ch.id,
    title: ch.snippet.title,
    customUrl: ch.snippet.customUrl,
    subscriberCount: ch.statistics.subscriberCount
      ? Number(ch.statistics.subscriberCount)
      : undefined,
    videoCount: ch.statistics.videoCount ? Number(ch.statistics.videoCount) : undefined,
    viewCount: ch.statistics.viewCount ? Number(ch.statistics.viewCount) : undefined,
    uploadsPlaylistId: ch.contentDetails.relatedPlaylists?.uploads,
  };
}
