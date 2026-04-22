import type { ArtistProfile, Platform } from "@prisma/client";
import { prisma } from "@/lib/db";

// Costruisce il JSON di contesto che diamo a Claude.
// Rimane stringificato come user message — il system prompt resta cachato.

export interface AccountSummary {
  platform: Platform;
  handle: string;
  connected: boolean;
  followers?: number;
  followersDelta7d?: number;
  followersDelta30d?: number;
  topPosts?: Array<{
    postedAt: string;
    mediaType: string;
    likes?: number | null;
    comments?: number | null;
    reach?: number | null;
    caption?: string | null;
  }>;
  audience?: {
    ageBuckets?: unknown;
    topCountries?: unknown;
  } | null;
  notes?: string;
}

export interface RecommenderContext {
  today: string; // YYYY-MM-DD
  timezone: string;
  artist: {
    stageName: string;
    genre: string;
    city?: string | null;
    bio?: string | null;
    goals?: unknown;
  };
  accounts: AccountSummary[];
  calendarAhead: {
    upcomingReleases?: string[];
    liveDates?: string[];
  };
}

export async function buildContext(userId: string): Promise<RecommenderContext> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      artistProfile: true,
      socialAccounts: {
        include: {
          metrics: { orderBy: { capturedAt: "desc" }, take: 30 },
          posts: { orderBy: { postedAt: "desc" }, take: 10 },
          audienceInsights: { orderBy: { capturedAt: "desc" }, take: 1 },
        },
      },
    },
  });

  const artist: RecommenderContext["artist"] = user.artistProfile
    ? artistFromProfile(user.artistProfile)
    : {
        stageName: user.name ?? "Artista",
        genre: "non specificato",
      };

  const accounts: AccountSummary[] = user.socialAccounts.map((a) => {
    const latest = a.metrics[0];
    const delta7 = diffFollowers(a.metrics, 7);
    const delta30 = diffFollowers(a.metrics, 30);
    const topPosts = [...a.posts]
      .sort((p1, p2) => engagement(p2) - engagement(p1))
      .slice(0, 5)
      .map((p) => ({
        postedAt: p.postedAt.toISOString(),
        mediaType: p.mediaType,
        likes: p.likes,
        comments: p.comments,
        reach: p.reach,
        caption: p.caption?.slice(0, 220) ?? null,
      }));
    const latestAudience = a.audienceInsights[0];

    return {
      platform: a.platform,
      handle: a.handle,
      connected: true,
      followers: latest?.followers ?? undefined,
      followersDelta7d: delta7,
      followersDelta30d: delta30,
      topPosts,
      audience: latestAudience
        ? {
            ageBuckets: latestAudience.ageBuckets ?? undefined,
            topCountries: latestAudience.topCountries ?? undefined,
          }
        : null,
      notes: a.lastSyncError ?? undefined,
    };
  });

  const now = new Date();
  return {
    today: now.toISOString().slice(0, 10),
    timezone: user.timezone,
    artist,
    accounts,
    calendarAhead: {}, // popolato in una milestone successiva
  };
}

function artistFromProfile(p: ArtistProfile): RecommenderContext["artist"] {
  return {
    stageName: p.stageName,
    genre: p.genre,
    city: p.city,
    bio: p.bio,
    goals: p.goals,
  };
}

function engagement(p: {
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
}): number {
  return (p.likes ?? 0) + (p.comments ?? 0) * 2 + (p.shares ?? 0) * 3 + (p.saves ?? 0) * 2;
}

function diffFollowers(
  metrics: { capturedAt: Date; followers: number | null }[],
  days: number,
): number | undefined {
  if (metrics.length < 2) return undefined;
  const latest = metrics[0];
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const past = metrics.find((m) => m.capturedAt.getTime() <= cutoff);
  if (!latest?.followers || !past?.followers) return undefined;
  return latest.followers - past.followers;
}
