import type { Platform } from "@prisma/client";
import { auth } from "@/auth";
import { ConnectAccountButton } from "@/components/ConnectAccountButton";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const PLATFORMS: Platform[] = ["INSTAGRAM", "FACEBOOK", "TIKTOK", "YOUTUBE", "SPOTIFY"];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const sp = await searchParams;

  const [profile, accounts] = await Promise.all([
    prisma.artistProfile.findUnique({ where: { userId: session.user.id } }),
    prisma.socialAccount.findMany({ where: { userId: session.user.id } }),
  ]);

  const byPlatform = new Map<Platform, (typeof accounts)[number]>();
  for (const a of accounts) byPlatform.set(a.platform, a);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Impostazioni</h1>
        <p className="text-sm text-neutral-500">
          Collega i tuoi profili e compila il tuo profilo artistico per migliorare i
          suggerimenti.
        </p>
      </header>

      {sp.connected === "meta" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-100">
          ✅ Meta collegato: {sp.pages} Pagine Facebook,{" "}
          {sp.instagram && Number(sp.instagram) > 0
            ? `${sp.instagram} profilo Instagram Business`
            : "nessun IG Business (collegane uno alla Pagina e riprova)"}
          .
        </div>
      ) : null}
      {sp.connected === "youtube" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-100">
          ✅ YouTube collegato: canale <strong>{sp.channel}</strong>.
        </div>
      ) : null}
      {sp.connected === "tiktok" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-100">
          ✅ TikTok collegato: <strong>@{sp.handle}</strong>.
        </div>
      ) : null}
      {sp.connected === "spotify" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-100">
          ✅ Spotify collegato: artista <strong>{sp.artist}</strong>.
        </div>
      ) : null}
      {sp.error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-100">
          ❌ Errore OAuth: <code>{sp.error}</code>
          {sp.message ? <> — {sp.message}</> : null}
          {sp.error === "no_youtube_channel" ? (
            <p className="mt-2">
              L'account Google che hai autorizzato non ha un canale YouTube associato.
              Crea un canale su YouTube e riprova.
            </p>
          ) : null}
        </div>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Profilo artista
        </h2>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900">
          {profile ? (
            <dl className="grid grid-cols-2 gap-y-2">
              <dt className="text-neutral-500">Stage name</dt>
              <dd>{profile.stageName}</dd>
              <dt className="text-neutral-500">Genere</dt>
              <dd>{profile.genre}</dd>
              {profile.city && (
                <>
                  <dt className="text-neutral-500">Città</dt>
                  <dd>{profile.city}</dd>
                </>
              )}
            </dl>
          ) : (
            <p className="text-neutral-500">
              Nessun profilo creato. (L'editor profilo arriva in una milestone
              successiva; per ora popola a mano via Prisma Studio.)
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Account social
        </h2>
        <div className="space-y-2">
          {PLATFORMS.map((p) => {
            const acc = byPlatform.get(p);
            return (
              <ConnectAccountButton
                key={p}
                platform={p}
                connected={!!acc}
                handle={acc?.handle}
              />
            );
          })}
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          Instagram e Facebook si connettono con lo stesso flusso Meta. TikTok,
          YouTube e Spotify arrivano nei milestone M2-M4.
        </p>
      </section>
    </div>
  );
}
