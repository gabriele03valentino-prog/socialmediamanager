import type { Platform, PostOutcome } from "@prisma/client";

interface PostMetrics {
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  views: number | null;
  reach: number | null;
}

export interface PrimaryMetric {
  name: "engagement" | "views" | "reach";
  value: number;
}

export function primaryMetric(platform: Platform, p: PostMetrics): PrimaryMetric | null {
  if (platform === "SPOTIFY") return null;
  if (platform === "TIKTOK" || platform === "YOUTUBE") {
    return { name: "views", value: p.views ?? 0 };
  }
  // IG / FB
  const eng =
    (p.likes ?? 0) +
    (p.comments ?? 0) * 2 +
    (p.shares ?? 0) * 3 +
    (p.saves ?? 0) * 2;
  return { name: "engagement", value: eng };
}

export interface PostMortemResult {
  outcome: PostOutcome;
  ratio: number;
}

export function evaluatePostMortem(postValue: number, baseline: number): PostMortemResult {
  const safeBaseline = Math.max(baseline, 1);
  const ratio = postValue / safeBaseline;
  let outcome: PostOutcome;
  if (ratio >= 2.0) outcome = "OUTLIER_HIGH";
  else if (ratio >= 1.2) outcome = "ABOVE";
  else if (ratio >= 0.8) outcome = "NORMAL";
  else if (ratio >= 0.5) outcome = "BELOW";
  else outcome = "OUTLIER_LOW";
  return { outcome, ratio };
}

const KEYWORDS = [
  "lyric",
  "snippet",
  "bts",
  "behind",
  "studio",
  "day in",
  "qa",
  "q&a",
  "freestyle",
  "dj set",
  "drop",
  "release",
  "reaction",
  "duet",
  "collab",
  "tutorial",
  "tip",
  "preview",
  "teaser",
  "live",
  "anteprima",
];

export function extractInsightTags(caption: string | null | undefined): string[] {
  if (!caption) return [];
  const lower = caption.toLowerCase();
  return KEYWORDS.filter((kw) => lower.includes(kw)).map((kw) =>
    kw.replace("&", "and").replace(/\s/g, ""),
  );
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}
