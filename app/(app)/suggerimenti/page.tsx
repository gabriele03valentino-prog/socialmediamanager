import { auth } from "@/auth";
import { SuggestionCard } from "@/components/SuggestionCard";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SuggestionsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const suggestions = await prisma.suggestion.findMany({
    where: { userId: session.user.id, status: "PROPOSED" },
    orderBy: { forDate: "asc" },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Suggerimenti</h1>
        <p className="text-sm text-neutral-500">
          Proposte generate dall'ultimo ciclo di analisi. Accettale per creare una
          bozza nel Calendario.
        </p>
      </header>
      {suggestions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
          Nessun suggerimento pendente.
        </div>
      ) : (
        <div className="space-y-4">
          {suggestions.map((s) => (
            <SuggestionCard key={s.id} s={s} />
          ))}
        </div>
      )}
    </div>
  );
}
