// Best-effort handle availability check.
// Usa probe HTTP "pubblici" senza OAuth. NON è 100% affidabile perché le
// piattaforme cambiano risposta in base a bot detection / login wall;
// aggreghiamo quindi la heuristica con uno stato "unknown".

import { spotifyFetch } from "./platforms/spotify-oauth";

export type HandleStatus = "free" | "taken" | "unknown";

export interface HandleCheckResult {
  instagram: HandleStatus;
  tiktok: HandleStatus;
  spotify: HandleStatus;
}

async function probe(url: string): Promise<number | null> {
  try {
    // Instagram e TikTok rifiutano HEAD da alcuni IP → usiamo GET senza seguire redirect lunghi.
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        accept: "text/html",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    return res.status;
  } catch {
    return null;
  }
}

function sanitizeHandle(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 30);
}

export async function checkHandle(name: string): Promise<HandleCheckResult> {
  const handle = sanitizeHandle(name);
  if (!handle) {
    return { instagram: "unknown", tiktok: "unknown", spotify: "unknown" };
  }

  const [igStatus, ttStatus, spotifyStatus] = await Promise.all([
    probe(`https://www.instagram.com/${handle}/`).then(toIgStatus),
    probe(`https://www.tiktok.com/@${handle}`).then(toTtStatus),
    checkSpotifyArtistName(name),
  ]);

  return {
    instagram: igStatus,
    tiktok: ttStatus,
    spotify: spotifyStatus,
  };
}

function toIgStatus(code: number | null): HandleStatus {
  // 200 = profilo esiste; 404 = libero; 302/301 a login = "unknown" (IG blocca scrape).
  if (code === 200) return "taken";
  if (code === 404) return "free";
  return "unknown";
}

function toTtStatus(code: number | null): HandleStatus {
  if (code === 200) return "taken";
  if (code === 404) return "free";
  return "unknown";
}

async function checkSpotifyArtistName(name: string): Promise<HandleStatus> {
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    return "unknown";
  }
  try {
    const encoded = encodeURIComponent(`artist:"${name}"`);
    const json = await spotifyFetch<{
      artists?: { items?: Array<{ name: string }> };
    }>(`/search?q=${encoded}&type=artist&limit=5&market=IT`);
    const items = json.artists?.items ?? [];
    const exact = items.some(
      (a) => a.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );
    return exact ? "taken" : "free";
  } catch {
    return "unknown";
  }
}
