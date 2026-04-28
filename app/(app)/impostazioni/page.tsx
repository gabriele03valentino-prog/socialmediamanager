import type { Platform } from "@prisma/client";
import { redirect } from "next/navigation";
import { ConnectAccountButton } from "@/components/ConnectAccountButton";
import { getActiveProject } from "@/lib/active-project";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const PLATFORMS: Platform[] = ["INSTAGRAM", "FACEBOOK", "TIKTOK", "YOUTUBE", "SPOTIFY"];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const project = await getActiveProject();
  if (!project) redirect("/onboarding");

  const sp = await searchParams;

  const [user, accounts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: project.userId },
      select: { timezone: true },
    }),
    prisma.socialAccount.findMany({ where: { projectId: project.id } }),
  ]);

  const byPlatform = new Map<Platform, (typeof accounts)[number]>();
  for (const a of accounts) byPlatform.set(a.platform, a);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Impostazioni</h1>
        <p className="text-sm text-neutral-500">
          Collega gli account social del progetto attivo. I dati del progetto si
          modificano da{" "}
          <a href="/progetti" className="text-brand-600 hover:underline">
            Progetti
          </a>
          .
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
          {sp.error === "no_pages" ? (
            <div className="mt-3 space-y-2">
              <p>
                Il tuo account Facebook non ha nessuna Pagina. Instagram Graph API
                richiede obbligatoriamente una Pagina FB di riferimento collegata
                al profilo IG Business/Creator.
              </p>
              <p className="font-medium">Come risolvere (5 minuti):</p>
              <ol className="ml-4 list-decimal space-y-1 text-xs">
                <li>
                  Apri{" "}
                  <a
                    href="https://www.facebook.com/pages/create"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:no-underline"
                  >
                    facebook.com/pages/create ↗
                  </a>{" "}
                  e crea una Pagina categoria "Musicista/gruppo" o "Artista".
                </li>
                <li>
                  Sull'app Instagram: Profilo → Modifica profilo → Informazioni
                  aziendali pubbliche → <strong>Pagina</strong> → collega la
                  Pagina appena creata.
                </li>
                <li>
                  Verifica che il tuo IG sia <strong>Business</strong> o{" "}
                  <strong>Creator</strong> (App IG → Impostazioni → Account →
                  "Passa ad account professionale").
                </li>
                <li>Torna qui e clicca di nuovo "Connetti Instagram".</li>
              </ol>
            </div>
          ) : null}
        </div>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Fuso orario
        </h2>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900">
          <p>
            <strong>{user?.timezone ?? "Europe/Rome"}</strong>
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Usato per orari suggeriti, cron giornaliero ed export .ics.
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Account social del progetto
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
          Instagram + Facebook condividono il flusso Meta. Spotify ha una{" "}
          <a href="/impostazioni/spotify" className="text-brand-600 underline">
            pagina dedicata
          </a>{" "}
          per incollare l'URL artista e aggiornare gli ascoltatori mensili.
        </p>
      </section>
    </div>
  );
}
