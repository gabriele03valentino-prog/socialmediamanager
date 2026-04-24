// Handle availability check.
//
// Instagram e TikTok bloccano aggressivamente lo scrape via HTTP (rate limit
// su IP datacenter, WAF, redirect a login wall). Un probe "furbo" con User-Agent
// browser dà falsi negativi nella maggioranza dei casi in produzione. Per non
// mentire all'utente con un badge "da verificare" passivo, per IG e TikTok
// ritorniamo sempre "manual" e la UI mostra un link che apre il profilo in un
// click — così l'utente ottiene risposta reale in 1 secondo invece che un check
// automatico fragile.
//
// Spotify invece ha Web API ufficiale e Client Credentials flow gratuito → il
// check "libero/occupato" è affidabile e lo facciamo lato server.

import { spotifyFetch } from "./platforms/spotify-oauth";

export type HandleStatus = "free" | "taken" | "unknown" | "manual";

export interface HandleCheckResult {
  instagram: HandleStatus;
  tiktok: HandleStatus;
  spotify: HandleStatus;
}

export async function checkHandle(name: string): Promise<HandleCheckResult> {
  const spotify = await checkSpotifyArtistName(name);
  return {
    // IG e TikTok richiedono verifica manuale (link in UI).
    instagram: "manual",
    tiktok: "manual",
    spotify,
  };
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

// URL pubblici per il check manuale dal browser dell'utente.
// Usati dalla UI per i chip "verifica su IG/TikTok ↗".
export function manualCheckUrl(
  platform: "instagram" | "tiktok",
  name: string,
): string {
  const handle = name
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 30);
  if (platform === "instagram") return `https://www.instagram.com/${handle}/`;
  return `https://www.tiktok.com/@${handle}`;
}
