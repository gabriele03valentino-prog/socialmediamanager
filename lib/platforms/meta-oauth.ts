// OAuth + wrapper di fetch per Graph API Meta (IG Business + Facebook Pages).
// Usato da: /api/connect/meta/start, /callback, lib/platforms/meta.ts

import { GRAPH_API_VERSION, GRAPH_BASE } from "./meta-constants";

export const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_manage_insights",
  "business_management",
] as const;

export const META_OAUTH_DIALOG = `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth`;

export function authorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(META_OAUTH_DIALOG);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  url.searchParams.set("scope", META_SCOPES.join(","));
  url.searchParams.set("response_type", "code");
  return url.toString();
}

export interface TokenResponse {
  access_token: string;
  token_type: "bearer";
  expires_in?: number; // secondi
}

// Step 1: scambia il code della redirect per uno short-lived user token (~1h).
export async function exchangeCodeForToken(args: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<TokenResponse> {
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("client_id", args.clientId);
  url.searchParams.set("client_secret", args.clientSecret);
  url.searchParams.set("redirect_uri", args.redirectUri);
  url.searchParams.set("code", args.code);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Meta token exchange fallito: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as TokenResponse;
}

// Step 2: scambia lo short-lived per un long-lived user token (~60 giorni).
export async function exchangeForLongLived(args: {
  shortLivedToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<TokenResponse> {
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", args.clientId);
  url.searchParams.set("client_secret", args.clientSecret);
  url.searchParams.set("fb_exchange_token", args.shortLivedToken);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `Meta long-lived exchange fallito: ${res.status} ${await res.text()}`,
    );
  }
  return (await res.json()) as TokenResponse;
}

export interface PageInfo {
  id: string;
  name: string;
  accessToken: string;
  instagramBusinessAccount?: {
    id: string;
    username: string;
  };
}

// Step 3: lista le Pagine FB dell'utente con page token long-lived + IG collegato.
export async function fetchPages(userAccessToken: string): Promise<PageInfo[]> {
  const url = new URL(`${GRAPH_BASE}/me/accounts`);
  url.searchParams.set(
    "fields",
    "id,name,access_token,instagram_business_account{id,username}",
  );
  url.searchParams.set("access_token", userAccessToken);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Meta /me/accounts fallito: ${res.status} ${await res.text()}`);
  }
  type Raw = {
    data?: Array<{
      id: string;
      name: string;
      access_token: string;
      instagram_business_account?: { id: string; username: string };
    }>;
  };
  const json = (await res.json()) as Raw;
  return (json.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    accessToken: p.access_token,
    instagramBusinessAccount: p.instagram_business_account
      ? {
          id: p.instagram_business_account.id,
          username: p.instagram_business_account.username,
        }
      : undefined,
  }));
}

// Wrapper fetch generico per il Graph, usato dall'adapter.
export async function graphGet<T = unknown>(
  path: string,
  params: Record<string, string>,
  accessToken: string,
): Promise<T> {
  const url = new URL(`${GRAPH_BASE}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta Graph ${path} fallito: ${res.status} ${body}`);
  }
  return (await res.json()) as T;
}
