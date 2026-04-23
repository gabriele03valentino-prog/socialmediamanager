import type { Platform } from "@prisma/client";
import type { PlatformAdapter } from "./adapter";
import { facebookAdapter, instagramAdapter } from "./meta";
import { spotifyAdapter } from "./spotify";
import { tiktokAdapter } from "./tiktok";
import { youtubeAdapter } from "./youtube";

export { NotImplementedYet } from "./adapter";
export type { PlatformAdapter } from "./adapter";

export const adapters: Record<Platform, PlatformAdapter> = {
  INSTAGRAM: instagramAdapter,
  FACEBOOK: facebookAdapter,
  TIKTOK: tiktokAdapter,
  YOUTUBE: youtubeAdapter,
  SPOTIFY: spotifyAdapter,
};

export function getAdapter(platform: Platform): PlatformAdapter {
  return adapters[platform];
}
