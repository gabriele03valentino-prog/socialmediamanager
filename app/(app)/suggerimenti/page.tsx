import { redirect } from "next/navigation";
import { GeneratePlanButton } from "@/components/GeneratePlanButton";
import { SuggestionCard } from "@/components/SuggestionCard";
import { getActiveProject } from "@/lib/active-project";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SuggestionsPage() {
  const project = await getActiveProject();
  if (!project) redirect("/progetti?create=1");

  const suggestions = await prisma.suggestion.findMany({
    where: { projectId: project.id, status: "PROPOSED" },
    orderBy: { forDate: "asc" },
    include: { neuroScore: true },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Suggerimenti</h1>
          <p className="text-sm text-neutral-500">
            Piano settimanale generato da Claude in base ai dati dei tuoi profili e al
            progetto attivo. Accetta per creare una bozza, o lancia il neuro-score
            per un check neuromarketing.
          </p>
        </div>
        <GeneratePlanButton />
      </header>

      {suggestions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 dark:border-neutral-700 dark:bg-neutral-900">
          <h2 className="text-base font-semibold">Nessun suggerimento pendente</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Per generare un piano settimanale rilevante, Claude ha bisogno di conoscerti
            e di vedere i dati dei tuoi profili. Bastano 3 passi:
          </p>
          <ol className="mt-4 space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 dark:bg-brand-700/20 dark:text-brand-100">
                1
              </span>
              <span>
                <a
                  href="/impostazioni"
                  className="font-medium text-brand-600 hover:underline"
                >
                  Connetti almeno un account social
                </a>{" "}
                — Instagram, TikTok, YouTube o Spotify (anche solo uno basta per partire).
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 dark:bg-brand-700/20 dark:text-brand-100">
                2
              </span>
              <span>
                <a
                  href="/progetti"
                  className="font-medium text-brand-600 hover:underline"
                >
                  Compila i dati del progetto
                </a>{" "}
                — nicchia, città, bio e obiettivi.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 dark:bg-brand-700/20 dark:text-brand-100">
                3
              </span>
              <span>
                Clicca <strong>“Genera piano settimanale”</strong> qui sopra: Claude
                proporrà 7-10 contenuti su misura, ognuno con caption, hashtag e
                rationale.
              </span>
            </li>
          </ol>
        </div>
      ) : (
        <div className="space-y-4">
          {suggestions.map((s) => (
            <SuggestionCard
              key={s.id}
              s={s}
              neuroScore={s.neuroScore}
              showActions
            />
          ))}
        </div>
      )}
    </div>
  );
}
