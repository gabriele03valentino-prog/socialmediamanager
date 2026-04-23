// Spotify Web API (dati pubblici dell'artista).
// Usiamo il Client Credentials Flow: nessun OAuth lato utente necessario,
// perché ci serve solo leggere dati pubblici (follower, popularity, uscite).
// Lo user flow servirebbe per playlist private / top tracks personali, non
// per i dati artista → teniamo l'esperienza semplice: l'utente incolla il suo
// URL artista e il server fa il lookup.

export const SPOTIFY_ACCOUNTS_BASE = "https://accounts.spotify.com";
export const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAppToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET non configurati");
  }
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch(`${SPOTIFY_ACCOUNTS_BASE}/api/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${basic}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Spotify token: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return cachedToken.token;
}

export async function spotifyFetch<T>(path: string): Promise<T> {
  const token = await getAppToken();
  const res = await fetch(`${SPOTIFY_API_BASE}${path}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Spotify ${path}: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

// Accetta URL web, URI spotify:artist:..., o l'ID nudo. Restituisce l'ID o null.
export function parseArtistId(input: string): string | null {
  const t = input.trim();
  const urlMatch = t.match(/spotify\.com\/artist\/([A-Za-z0-9]+)/);
  if (urlMatch) return urlMatch[1] ?? null;
  const uriMatch = t.match(/^spotify:artist:([A-Za-z0-9]+)$/);
  if (uriMatch) return uriMatch[1] ?? null;
  if (/^[A-Za-z0-9]{22}$/.test(t)) return t;
  return null;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  followers: { total: number };
  popularity: number;
  genres: string[];
  images?: Array<{ url: string; width: number; height: number }>;
  external_urls?: { spotify: string };
}

export async function fetchArtist(id: string): Promise<SpotifyArtist> {
  return spotifyFetch<SpotifyArtist>(`/artists/${id}`);
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  release_date: string;
  album_type: string;
  album_group?: string;
  total_tracks: number;
  images?: Array<{ url: string }>;
  external_urls?: { spotify: string };
}

export async function fetchArtistReleases(id: string): Promise<SpotifyAlbum[]> {
  const json = await spotifyFetch<{ items?: SpotifyAlbum[] }>(
    `/artists/${id}/albums?include_groups=album,single&market=IT&limit=20`,
  );
  return json.items ?? [];
}

export interface SpotifyTrack {
  id: string;
  name: string;
  popularity: number;
  duration_ms: number;
  external_urls?: { spotify: string };
}

export async function fetchArtistTopTracks(id: string): Promise<SpotifyTrack[]> {
  const json = await spotifyFetch<{ tracks?: SpotifyTrack[] }>(
    `/artists/${id}/top-tracks?market=IT`,
  );
  return json.tracks ?? [];
}
