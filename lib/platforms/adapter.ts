import type { Platform, SocialAccount } from "@prisma/client";

// Risultati "grezzi" che ciascun adapter restituisce al layer di sync,
// che poi li persiste nei modelli MetricSnapshot / Post / AudienceInsight.

export interface MetricsResult {
  followers?: number;
  following?: number;
  postsCount?: number;
  reach?: number;
  impressions?: number;
  profileViews?: number;
  extra?: Record<string, unknown>;
}

export interface PostResult {
  externalId: string;
  postedAt: Date;
  mediaType:
    | "IMAGE"
    | "VIDEO"
    | "CAROUSEL"
    | "REEL"
    | "STORY"
    | "SHORT"
    | "LIVE"
    | "OTHER";
  caption?: string;
  permalink?: string;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  views?: number;
  reach?: number;
  impressions?: number;
  raw?: Record<string, unknown>;
}

export interface AudienceResult {
  ageBuckets?: Record<string, number>;
  genderSplit?: Record<string, number>;
  topCountries?: Array<{ code: string; share: number }>;
  topCities?: Array<{ name: string; share: number }>;
}

export interface PlatformAdapter {
  readonly platform: Platform;

  /** Pull follower/engagement count per il profilo. */
  syncMetrics(account: SocialAccount): Promise<MetricsResult>;

  /** Pull dei post recenti (ultimi 30 giorni circa). */
  syncRecentPosts(account: SocialAccount): Promise<PostResult[]>;

  /** Pull demografica pubblico. Restituisce `null` se non supportato. */
  syncAudience(account: SocialAccount): Promise<AudienceResult | null>;
}

export class NotImplementedYet extends Error {
  constructor(platform: Platform, capability: string) {
    super(`${platform}: ${capability} non ancora implementato. Vedi milestone in README.`);
    this.name = "NotImplementedYet";
  }
}
