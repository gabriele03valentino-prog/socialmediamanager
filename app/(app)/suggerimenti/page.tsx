import { auth } from "@/auth";
import { GeneratePlanButton } from "@/components/GeneratePlanButton";
import { SuggestionCard } from "@/components/SuggestionCard";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SuggestionsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const suggestions = await prisma.suggestion.findMany({
    where: { userId: session.user.id, status: "PROPOSED" },
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
            tuo profilo artista. Accetta per creare una bozza, o lancia il neuro-score
            per un check neuromarketing.
          </p>
        </div>
        <GeneratePlanButton />
      </header>

      {suggestions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
          Nessun suggerimento pendente. Completa il{" "}
          <a href="/impostazioni/profilo" className="text-brand-600 underline">
            profilo artista
          </a>{" "}
          e clicca "Genera piano settimanale".
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
