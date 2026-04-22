import type { SocialAccount } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAdapter, NotImplementedYet } from "@/lib/platforms";

// Orchestrazione comune per il sync di un singolo account social.
// Usata sia dal cron giornaliero che dall'endpoint manuale /api/metrics/sync.

export async function syncAccount(account: SocialAccount): Promise<{
  metrics: boolean;
  posts: number;
  audience: boolean;
  error?: string;
}> {
  const adapter = getAdapter(account.platform);
  let metricsOk = false;
  let postsCount = 0;
  let audienceOk = false;
  let errorMsg: string | undefined;

  try {
    const m = await adapter.syncMetrics(account);
    await prisma.metricSnapshot.create({
      data: {
        accountId: account.id,
        followers: m.followers,
        following: m.following,
        postsCount: m.postsCount,
        reach: m.reach,
        impressions: m.impressions,
        profileViews: m.profileViews,
        extra: (m.extra ?? null) as never,
      },
    });
    metricsOk = true;
  } catch (err) {
    if (!(err instanceof NotImplementedYet)) {
      errorMsg = errMsg(err);
    }
  }

  try {
    const posts = await adapter.syncRecentPosts(account);
    for (const p of posts) {
      await prisma.post.upsert({
        where: {
          accountId_externalId: {
            accountId: account.id,
            externalId: p.externalId,
          },
        },
        create: {
          accountId: account.id,
          externalId: p.externalId,
          postedAt: p.postedAt,
          mediaType: p.mediaType,
          caption: p.caption,
          permalink: p.permalink,
          likes: p.likes,
          comments: p.comments,
          shares: p.shares,
          saves: p.saves,
          views: p.views,
          reach: p.reach,
          impressions: p.impressions,
          raw: (p.raw ?? null) as never,
          lastSyncedAt: new Date(),
        },
        update: {
          caption: p.caption,
          likes: p.likes,
          comments: p.comments,
          shares: p.shares,
          saves: p.saves,
          views: p.views,
          reach: p.reach,
          impressions: p.impressions,
          raw: (p.raw ?? null) as never,
          lastSyncedAt: new Date(),
        },
      });
    }
    postsCount = posts.length;
  } catch (err) {
    if (!(err instanceof NotImplementedYet)) {
      errorMsg = errorMsg ?? errMsg(err);
    }
  }

  try {
    const a = await adapter.syncAudience(account);
    if (a) {
      await prisma.audienceInsight.create({
        data: {
          accountId: account.id,
          ageBuckets: (a.ageBuckets ?? null) as never,
          genderSplit: (a.genderSplit ?? null) as never,
          topCountries: (a.topCountries ?? null) as never,
          topCities: (a.topCities ?? null) as never,
        },
      });
      audienceOk = true;
    }
  } catch (err) {
    if (!(err instanceof NotImplementedYet)) {
      errorMsg = errorMsg ?? errMsg(err);
    }
  }

  await prisma.socialAccount.update({
    where: { id: account.id },
    data: {
      lastSyncedAt: new Date(),
      lastSyncError: errorMsg ?? null,
    },
  });

  return { metrics: metricsOk, posts: postsCount, audience: audienceOk, error: errorMsg };
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
