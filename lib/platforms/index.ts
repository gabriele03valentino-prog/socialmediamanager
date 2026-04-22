import type { Platform } from "@prisma/client";
import type { PlatformAdapter } from "./adapter";
import { metaAdapter } from "./meta";
import { spotifyAdapter } from "./spotify";
import { tiktokAdapter } from "./tiktok";
import { youtubeAdapter } from "./youtube";

export { NotImplementedYet } from "./adapter";
export type { PlatformAdapter } from "./adapter";

// IG e FB condividono il connettore Meta (stesso token, endpoint paralleli).
// Per M0 registriamo entrambe sulla stessa implementazione; in M1 possiamo
// differenziare con piccole varianti.
export const adapters: Record<Platform, PlatformAdapter> = {
  INSTAGRAM: metaAdapter,
  FACEBOOK: { ...metaAdapter, platform: "FACEBOOK" },
  TIKTOK: tiktokAdapter,
  YOUTUBE: youtubeAdapter,
  SPOTIFY: spotifyAdapter,
};

export function getAdapter(platform: Platform): PlatformAdapter {
  return adapters[platform];
}
