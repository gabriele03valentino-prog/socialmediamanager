import type { Platform } from "@prisma/client";
import { auth } from "@/auth";
import { KpiCard } from "@/components/KpiCard";
import { SuggestionCard } from "@/components/SuggestionCard";
import { prisma } from "@/lib/db";
import { PLATFORM_LABEL } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PLATFORMS: Platform[] = ["INSTAGRAM", "TIKTOK", "YOUTUBE", "SPOTIFY"];

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = session.user.id;
  const accounts = await prisma.socialAccount.findMany({
    where: { userId },
    include: {
      metrics: { orderBy: { capturedAt: "desc" }, take: 10 },
    },
  });
  const nextSuggestion = await prisma.suggestion.findFirst({
    where: { userId, status: "PROPOSED" },
    orderBy: { forDate: "asc" },
  });

  const byPlatform = new Map(accounts.map((a) => [a.platform, a] as const));

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">
          Ciao {session.user.name?.split(" ")[0] ?? ""} 👋
        </h1>
        <p className="text-sm text-neutral-500">
          Qui trovi lo stato dei tuoi canali e il prossimo contenuto da produrre.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {PLATFORMS.map((p) => {
          const acc = byPlatform.get(p);
          const latest = acc?.metrics[0];
          const past = acc?.metrics[acc.metrics.length - 1];
          const delta =
            latest?.followers && past?.followers
              ? latest.followers - past.followers
              : undefined;
          return (
            <KpiCard
              key={p}
              label={PLATFORM_LABEL[p] ?? p}
              value={
                latest?.followers !== undefined && latest?.followers !== null
                  ? latest.followers.toLocaleString("it-IT")
                  : acc
                    ? "—"
                    : "non collegato"
              }
              delta={delta}
              hint={acc ? acc.handle : undefined}
            />
          );
        })}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Prossimo suggerimento</h2>
        {nextSuggestion ? (
          <SuggestionCard s={nextSuggestion} />
        ) : (
          <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
            Nessun suggerimento ancora. Vai in{" "}
            <span className="font-medium">Impostazioni</span> per collegare un account,
            oppure esegui il cron di generazione.
          </div>
        )}
      </section>
    </div>
  );
}
