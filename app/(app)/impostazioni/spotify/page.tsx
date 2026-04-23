import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SpotifySettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const sp = await searchParams;

  const account = await prisma.socialAccount.findFirst({
    where: { userId: session.user.id, platform: "SPOTIFY" },
    include: {
      metrics: { orderBy: { capturedAt: "desc" }, take: 1 },
    },
  });

  const latestListeners =
    (account?.metrics[0]?.extra as { manualMonthlyListeners?: number } | null)
      ?.manualMonthlyListeners ?? null;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Spotify</h1>
        <p className="text-sm text-neutral-500">
          Collega il tuo profilo artista e aggiorna manualmente gli ascoltatori mensili.
        </p>
      </header>

      {sp.updated ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-100">
          ✅ Ascoltatori mensili aggiornati.
        </div>
      ) : null}

      <section className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          {account ? "Artista collegato" : "Collega il tuo artista"}
        </h2>
        {account ? (
          <div className="space-y-2 text-sm">
            <p>
              <strong>{account.handle}</strong>{" "}
              <span className="text-neutral-500">({account.externalId})</span>
            </p>
            <p className="text-xs text-neutral-500">
              Puoi riconnettere a un artista diverso incollando un altro URL qui sotto.
            </p>
          </div>
        ) : (
          <p className="mb-4 text-sm text-neutral-500">
            Incolla l'URL del tuo profilo artista (es.{" "}
            <code>https://open.spotify.com/artist/abc123...</code>) o l'ID a 22
            caratteri.
          </p>
        )}

        <form
          action="/api/connect/spotify"
          method="POST"
          className="mt-4 flex flex-col gap-3 sm:flex-row"
        >
          <input
            name="artistUrl"
            type="text"
            placeholder="https://open.spotify.com/artist/…"
            required
            className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          />
          <button
            type="submit"
            className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
          >
            {account ? "Aggiorna" : "Collega"}
          </button>
        </form>
      </section>

      {account ? (
        <section className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Ascoltatori mensili
          </h2>
          <p className="mb-4 text-xs text-neutral-500">
            Spotify non espone questo dato via API. Aggiornalo una volta a settimana
            dall'app Spotify for Artists (Home → Ascoltatori mensili).
          </p>
          {latestListeners !== null ? (
            <p className="mb-4 text-sm">
              Ultimo valore:{" "}
              <strong>{latestListeners.toLocaleString("it-IT")}</strong>
            </p>
          ) : null}
          <form
            action="/api/spotify/monthly-listeners"
            method="POST"
            className="flex flex-col gap-3 sm:flex-row"
          >
            <input
              name="monthlyListeners"
              type="number"
              min={0}
              placeholder="es. 12450"
              required
              className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
            />
            <button
              type="submit"
              className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
            >
              Salva
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
