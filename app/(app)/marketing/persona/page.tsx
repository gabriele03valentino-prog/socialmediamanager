import Link from "next/link";
import { auth } from "@/auth";
import { GeneratePersonasButton } from "@/components/GeneratePersonasButton";
import { PersonaCard } from "@/components/PersonaCard";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PersonaPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [profile, personas] = await Promise.all([
    prisma.artistProfile.findUnique({ where: { userId: session.user.id } }),
    prisma.persona.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href="/marketing" className="text-sm text-brand-600 hover:underline">
          ← Marketing
        </Link>
      </div>
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Persona audience</h1>
          <p className="text-sm text-neutral-500">
            2-3 archetipi del tuo pubblico target. Usati da Claude per personalizzare
            il piano settimanale e le campagne release.
          </p>
        </div>
        {profile ? (
          <GeneratePersonasButton hasExisting={personas.length > 0} />
        ) : null}
      </header>

      {!profile ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
          Prima compila il{" "}
          <Link
            href="/impostazioni/profilo"
            className="underline hover:no-underline"
          >
            profilo artista
          </Link>
          .
        </div>
      ) : personas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
          Nessuna persona generata. Clicca "Genera persona" per creare 2-3 archetipi
          dell'audience a partire dal tuo genere, città e dati audience (se collegati).
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {personas.map((p) => (
            <PersonaCard key={p.id} persona={p} />
          ))}
        </div>
      )}
    </div>
  );
}
