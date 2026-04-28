import type {
  Project,
  Platform,
  CreatorKind,
  TrendKind,
  PostOutcome,
} from "@prisma/client";
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
  // Solo per TIKTOK: media views sugli ultimi N video sincronizzati.
  avgViewsLast20?: number;
  topPosts?: Array<{
    postedAt: string;
    mediaType: string;
    likes?: number | null;
    comments?: number | null;
    reach?: number | null;
    views?: number | null;
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
  project: {
    kind: CreatorKind;
    displayName: string;
    niche?: string | null;
    city?: string | null;
    bio?: string | null;
  };
  accounts: AccountSummary[];
  calendarAhead: {
    upcomingReleases?: string[];
    liveDates?: string[];
  };
  trends?: {
    active: Array<{ kind: TrendKind; name: string; platforms: Platform[] }>;
  };
  learnings?: {
    recentOutliers: Array<{
      outcome: PostOutcome;
      platform: Platform;
      contentType: string;
      ratio: number;
      insightTags: string[];
      captionSnippet: string | null;
    }>;
  };
}

export async function buildContext(projectId: string): Promise<RecommenderContext> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      user: { select: { timezone: true } },
      socialAccounts: {
        include: {
          metrics: { orderBy: { capturedAt: "desc" }, take: 30 },
          // Per TikTok ci servono 20 video per calcolare la media views;
          // per le altre 10 bastano.
          posts: { orderBy: { postedAt: "desc" }, take: 20 },
          audienceInsights: { orderBy: { capturedAt: "desc" }, take: 1 },
        },
      },
      trends: {
        where: { status: "ACTIVE" },
        take: 10,
        orderBy: { notedAt: "desc" },
      },
      postMortems: {
        where: {
          OR: [{ outcome: "OUTLIER_HIGH" }, { outcome: "OUTLIER_LOW" }],
          createdAt: { gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { createdAt: "desc" },
        take: 16,
      },
    },
  });

  const accounts: AccountSummary[] = project.socialAccounts.map((a) => {
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
        views: p.views,
        caption: p.caption?.slice(0, 220) ?? null,
      }));
    const latestAudience = a.audienceInsights[0];

    const avgViewsLast20 =
      a.platform === "TIKTOK"
        ? averageDefined(a.posts.map((p) => p.views ?? null))
        : undefined;

    return {
      platform: a.platform,
      handle: a.handle,
      connected: true,
      followers: latest?.followers ?? undefined,
      followersDelta7d: delta7,
      followersDelta30d: delta30,
      avgViewsLast20,
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
  const activeTrends = (project.trends ?? []).map((t) => ({
    kind: t.kind,
    name: t.name,
    platforms: t.platforms,
  }));
  // Split outlier per dare al recommender un mix bilanciato (più HIGH che LOW
  // per evitare bias eccessivo verso "cosa non funziona").
  const allMortems = project.postMortems ?? [];
  const highs = allMortems.filter((m) => m.outcome === "OUTLIER_HIGH").slice(0, 5);
  const lows = allMortems.filter((m) => m.outcome === "OUTLIER_LOW").slice(0, 3);
  const recentOutliers = [...highs, ...lows].map((m) => ({
    outcome: m.outcome,
    platform: m.platform,
    contentType: m.contentType,
    ratio: Number(m.ratio.toFixed(2)),
    insightTags: m.insightTags,
    captionSnippet: m.caption?.slice(0, 120) ?? null,
  }));
  return {
    today: now.toISOString().slice(0, 10),
    timezone: project.user.timezone,
    project: {
      kind: project.kind,
      displayName: project.displayName,
      niche: project.niche,
      city: project.city,
      bio: project.bio,
    },
    accounts,
    calendarAhead: {}, // popolato in una milestone successiva
    trends: { active: activeTrends },
    learnings: { recentOutliers },
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

function averageDefined(values: Array<number | null>): number | undefined {
  const defined = values.filter((v): v is number => v !== null && v !== undefined);
  if (defined.length === 0) return undefined;
  return Math.round(defined.reduce((s, v) => s + v, 0) / defined.length);
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
