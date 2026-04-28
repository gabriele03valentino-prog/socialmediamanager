import { redirect } from "next/navigation";
import { getActiveProject } from "@/lib/active-project";
import { prisma } from "@/lib/db";
import { LearningsTabs } from "./LearningsTabs";

export const dynamic = "force-dynamic";

export default async function LearningsPage() {
  const project = await getActiveProject();
  if (!project) redirect("/progetti?create=1");

  const postMortems = await prisma.postMortem.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const total = postMortems.length;
  const high = postMortems.filter((m) => m.outcome === "OUTLIER_HIGH").length;
  const low = postMortems.filter((m) => m.outcome === "OUTLIER_LOW").length;
  const outlierPct = total > 0 ? Math.round(((high + low) / total) * 100) : 0;

  const top = postMortems.filter(
    (m) => m.outcome === "OUTLIER_HIGH" || m.outcome === "ABOVE",
  );
  const flop = postMortems.filter(
    (m) => m.outcome === "OUTLIER_LOW" || m.outcome === "BELOW",
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Learnings</h1>
        <p className="text-sm text-neutral-500">
          Analisi automatica dei post pubblicati 48-72h fa, confrontati con la
          baseline mediana degli ultimi 30 giorni. I top performer e i flop
          vengono passati al recommender per modulare i prossimi suggerimenti.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Post analizzati" value={total.toString()} />
        <StatCard
          label="Top performer"
          value={high.toString()}
          tone="positive"
        />
        <StatCard label="Flop" value={low.toString()} tone="negative" />
        <StatCard label="% outlier" value={`${outlierPct}%`} />
      </section>

      <LearningsTabs all={postMortems} top={top} flop={flop} />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative";
}

function StatCard({ label, value, tone = "neutral" }: StatCardProps) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-700 dark:text-emerald-300"
      : tone === "negative"
        ? "text-rose-700 dark:text-rose-300"
        : "text-neutral-900 dark:text-neutral-100";
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}
