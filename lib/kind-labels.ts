import type { CreatorKind, CampaignType } from "@prisma/client";

export interface KindLabels {
  creator: string;
  content: string;
  goal: string;
}

export const KIND_LABELS: Record<CreatorKind, KindLabels> = {
  ARTIST:      { creator: "artista",      content: "post/video/reel", goal: "follower" },
  YOUTUBER:    { creator: "creator",      content: "video/short",     goal: "iscritti" },
  INFLUENCER:  { creator: "creator",      content: "post/reel/story", goal: "follower" },
  DIVULGATORE: { creator: "divulgatore",  content: "video/post",      goal: "iscritti" },
  PODCASTER:   { creator: "podcaster",    content: "episodi/clip",    goal: "ascoltatori" },
  BRAND:       { creator: "brand",        content: "post/campagne",   goal: "engagement" },
};

export function getKindLabels(kind: CreatorKind): KindLabels {
  return KIND_LABELS[kind];
}

export const KIND_DISPLAY: Record<CreatorKind, string> = {
  ARTIST:      "Artista / Producer",
  YOUTUBER:    "YouTuber",
  INFLUENCER:  "Influencer",
  DIVULGATORE: "Divulgatore",
  PODCASTER:   "Podcaster",
  BRAND:       "Brand",
};

export const KIND_CAMPAIGN_TYPES: Record<CreatorKind, CampaignType[]> = {
  ARTIST:      ["SINGOLO", "EP", "ALBUM", "LIVE", "MERCH", "EVENT"],
  YOUTUBER:    ["VIDEO_DROP", "SERIES", "SPONSOR", "EVENT", "MERCH"],
  INFLUENCER:  ["VIDEO_DROP", "SPONSOR", "EVENT", "MERCH", "PRODUCT"],
  DIVULGATORE: ["VIDEO_DROP", "SERIES", "EVENT", "PRODUCT"],
  PODCASTER:   ["EPISODE", "SERIES", "SPONSOR", "EVENT"],
  BRAND:       ["PRODUCT", "EVENT", "SPONSOR"],
};
