import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveProject } from "@/lib/active-project";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  SINGOLO: "Singolo",
  EP: "EP",
  ALBUM: "Album",
  LIVE: "Live",
  MERCH: "Merch",
};

export default async function MarketingHubPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const project = await getActiveProject();
  if (!project) redirect("/progetti?create=1");
  const sp = await searchParams;

  const [personasCount, campaigns, avgScore] = await Promise.all([
    prisma.persona.count({ where: { projectId: project.id } }),
    prisma.campaign.findMany({
      where: { projectId: project.id },
      orderBy: { releaseDate: "desc" },
      take: 10,
      include: { _count: { select: { suggestions: true } } },
    }),
    prisma.neuroScore.aggregate({
      where: { projectId: project.id },
      _avg: { score: true },
      _count: { _all: true },
    }),
  ]);

  const scoreCount = avgScore._count._all;
  const scoreAvg = avgScore._avg.score ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Marketing & neuromarketing</h1>
        <p className="text-sm text-neutral-500">
          Persona audience, neuro-score su bozze/suggerimenti, campagne multi-touch
          per ogni release. Ispirato ai segnali brain-predictive di TRIBE v2 (Meta AI).
        </p>
      </header>

      {sp.created ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-100">
          ✅ Campagna creata con {sp.steps} tappe. Trovale in{" "}
          <Link href="/calendario" className="underline">
            Calendario
          </Link>{" "}
          come suggerimenti pronti da accettare.
        </div>
      ) : null}

      {personasCount === 0 && scoreCount === 0 && campaigns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900">
          <h2 className="text-base font-semibold">Inizia da qui</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Tre cose puoi fare subito per dare al recommender uno strato di neuromarketing:
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex gap-2">
              <span className="text-brand-600">→</span>
              <span>
                <Link
                  href="/marketing/persona"
                  className="font-medium text-brand-600 hover:underline"
                >
                  Genera 2-3 persona archetipiche
                </Link>{" "}
                del tuo pubblico — il recommender le userà come contesto per i suggerimenti.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand-600">→</span>
              <span>
                Apri un suggerimento o una bozza e clicca <strong>“Neuro-analisi”</strong>{" "}
                per uno score 0-100 + 3 consigli concreti per migliorare il contenuto.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand-600">→</span>
              <span>
                <Link
                  href="/marketing/campagna/nuova"
                  className="font-medium text-brand-600 hover:underline"
                >
                  Pianifica una campagna release
                </Link>{" "}
                — 5-7 tappe pre-popolate dal teaser al post-drop, neuro-ottimizzate.
              </span>
            </li>
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            Persona audience
          </div>
          <div className="mt-2 text-2xl font-semibold">{personasCount}</div>
          <p className="mt-1 text-xs text-neutral-500">
            archetipi attivi
          </p>
          <Link
            href="/marketing/persona"
            className="mt-3 inline-block text-sm text-brand-600 hover:underline"
          >
            {personasCount === 0 ? "Crea persona →" : "Gestisci →"}
          </Link>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            Neuro-score medio
          </div>
          <div className="mt-2 text-2xl font-semibold">
            {scoreCount > 0 ? `${Math.round(scoreAvg)}/100` : "—"}
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {scoreCount} contenuti analizzati
          </p>
          <span className="mt-3 inline-block text-xs text-neutral-400">
            apri un suggerimento o una bozza per analizzare
          </span>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            Campagne release
          </div>
          <div className="mt-2 text-2xl font-semibold">{campaigns.length}</div>
          <p className="mt-1 text-xs text-neutral-500">negli ultimi piani</p>
          <Link
            href="/marketing/campagna/nuova"
            className="mt-3 inline-block rounded-md bg-brand-600 px-3 py-1.5 text-xs text-white hover:bg-brand-700"
          >
            + Nuova campagna
          </Link>
        </div>
      </div>

      {campaigns.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Campagne recenti</h2>
          <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
            {campaigns.map((c) => (
              <li key={c.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="font-medium">{c.title}</div>
                  <div className="text-xs text-neutral-500">
                    {TYPE_LABEL[c.type] ?? c.type} · uscita{" "}
                    {c.releaseDate.toISOString().slice(0, 10)} · {c._count.suggestions}{" "}
                    tappe
                  </div>
                </div>
                <span className="text-xs uppercase tracking-wide text-neutral-400">
                  {c.status.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-xs text-neutral-500">
        🧠 I neuro-score sono stime basate sui principi del paper{" "}
        <a
          href="https://github.com/facebookresearch/tribev2"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          TRIBE v2 (Meta AI)
        </a>
        , prodotte da Claude che ragiona nelle categorie del modello. Per predizioni
        fMRI reali servirebbe inferenza GPU sul modello (licenza CC-BY-NC-4.0).
      </p>
    </div>
  );
}
