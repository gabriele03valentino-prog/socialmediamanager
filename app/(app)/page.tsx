import type { Platform } from "@prisma/client";
import { auth } from "@/auth";
import { type FollowerSeries, FollowerChart } from "@/components/FollowerChart";
import { KpiCard } from "@/components/KpiCard";
import { SuggestionCard } from "@/components/SuggestionCard";
import { SyncButton } from "@/components/SyncButton";
import { TopPostsList, type TopPostItem } from "@/components/TopPostsList";
import { prisma } from "@/lib/db";
import { PLATFORM_LABEL } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PLATFORMS: Platform[] = ["INSTAGRAM", "TIKTOK", "YOUTUBE", "SPOTIFY"];

function engagementOf(p: {
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  views: number | null;
}): number {
  return (
    (p.likes ?? 0) +
    (p.comments ?? 0) * 2 +
    (p.shares ?? 0) * 3 +
    (p.saves ?? 0) * 2 +
    (p.views ?? 0) * 0.01
  );
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);

  const [accounts, recentPosts] = await Promise.all([
    prisma.socialAccount.findMany({
      where: { userId },
      include: {
        metrics: {
          where: { capturedAt: { gte: thirtyDaysAgo } },
          orderBy: { capturedAt: "asc" },
        },
      },
    }),
    prisma.post.findMany({
      where: { account: { userId }, postedAt: { gte: thirtyDaysAgo } },
      include: { account: true },
    }),
  ]);

  const nextSuggestion = await prisma.suggestion.findFirst({
    where: { userId, status: "PROPOSED" },
    orderBy: { forDate: "asc" },
  });

  const byPlatform = new Map(accounts.map((a) => [a.platform, a] as const));

  // KPI + delta per piattaforma
  function kpiFor(platform: Platform) {
    const acc = byPlatform.get(platform);
    if (!acc) return { value: "non collegato", delta: undefined, hint: undefined };
    const metrics = acc.metrics;
    const latest = metrics.at(-1);
    const sevenDaysAgo = Date.now() - 7 * 86_400_000;
    const past = metrics.find((m) => m.capturedAt.getTime() >= sevenDaysAgo) ?? metrics[0];
    const delta =
      latest?.followers && past?.followers ? latest.followers - past.followers : undefined;
    return {
      value:
        latest?.followers !== undefined && latest?.followers !== null
          ? latest.followers.toLocaleString("it-IT")
          : "—",
      delta,
      hint: acc.handle,
    };
  }

  // Serie follower per grafico
  const series: FollowerSeries[] = accounts
    .filter((a) => a.metrics.length > 0)
    .map((a) => ({
      platform: a.platform,
      data: a.metrics.map((m) => ({
        date: m.capturedAt.toISOString().slice(0, 10),
        followers: m.followers ?? null,
      })),
    }));

  // Top 5 post per engagement
  const topPosts: TopPostItem[] = recentPosts
    .map((p) => ({
      id: p.id,
      platform: p.account.platform,
      postedAt: p.postedAt,
      caption: p.caption,
      permalink: p.permalink,
      likes: p.likes,
      comments: p.comments,
      views: p.views,
      reach: p.reach,
      mediaType: p.mediaType,
      engagement: engagementOf(p),
    }))
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            Ciao {session.user.name?.split(" ")[0] ?? ""} 👋
          </h1>
          <p className="text-sm text-neutral-500">
            Stato dei tuoi canali, top post degli ultimi 30 giorni e prossimo contenuto
            da produrre.
          </p>
        </div>
        <SyncButton />
      </header>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {PLATFORMS.map((p) => {
          const k = kpiFor(p);
          return (
            <KpiCard
              key={p}
              label={PLATFORM_LABEL[p] ?? p}
              value={k.value}
              delta={k.delta}
              hint={k.hint}
            />
          );
        })}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Andamento follower (30g)</h2>
        <FollowerChart series={series} />
      </section>

      <section className="grid gap-6 md:grid-cols-5">
        <div className="md:col-span-3">
          <h2 className="mb-3 text-lg font-semibold">Top 5 post (30g)</h2>
          <TopPostsList posts={topPosts} />
        </div>
        <div className="md:col-span-2">
          <h2 className="mb-3 text-lg font-semibold">Prossimo suggerimento</h2>
          {nextSuggestion ? (
            <SuggestionCard s={nextSuggestion} />
          ) : (
            <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
              Nessun suggerimento ancora. Genera il piano dal cron giornaliero o
              lancia la pagina Suggerimenti.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
