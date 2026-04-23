import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function BrandHubPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [profile, brand, ideasCount] = await Promise.all([
    prisma.artistProfile.findUnique({ where: { userId: session.user.id } }),
    prisma.brandIdentity.findUnique({ where: { userId: session.user.id } }),
    prisma.stageNameIdea.count({ where: { userId: session.user.id } }),
  ]);

  const hasIdentity = !!brand?.palette;
  const coversCount = Array.isArray(brand?.coverBriefs)
    ? (brand!.coverBriefs as unknown as unknown[]).length
    : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Brand & direzione artistica</h1>
        <p className="text-sm text-neutral-500">
          Tre passaggi per costruire l'identità del tuo progetto: nome, identità
          visiva, cover delle release.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/brand/nome"
          className="group rounded-xl border border-neutral-200 bg-white p-6 transition-colors hover:border-brand-500 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-brand-400"
        >
          <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">
            Passaggio 1
          </div>
          <h2 className="text-lg font-semibold">Stage name</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {profile?.stageName
              ? `Attuale: "${profile.stageName}". Puoi comunque esplorare altre opzioni.`
              : "Genera 10+ proposte con rationale e check disponibilità su IG/TikTok/Spotify."}
          </p>
          <p className="mt-3 text-xs text-neutral-500">
            {ideasCount} idee salvate →
          </p>
        </Link>

        <Link
          href="/brand/identita"
          className="group rounded-xl border border-neutral-200 bg-white p-6 transition-colors hover:border-brand-500 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-brand-400"
        >
          <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">
            Passaggio 2
          </div>
          <h2 className="text-lg font-semibold">Identità visiva</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Palette, typography, mood, logo SVG, prompt per claude.ai/design.
          </p>
          <p className="mt-3 text-xs text-neutral-500">
            {hasIdentity ? "✓ identità generata" : "non ancora generata"} →
          </p>
        </Link>

        <Link
          href="/brand/identita"
          className="group rounded-xl border border-neutral-200 bg-white p-6 transition-colors hover:border-brand-500 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-brand-400"
        >
          <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">
            Passaggio 3
          </div>
          <h2 className="text-lg font-semibold">Cover release</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Brief copertina per ogni uscita, con prompt già pronti per Claude
            Design, Midjourney e Ideogram.
          </p>
          <p className="mt-3 text-xs text-neutral-500">
            {coversCount} cover brief salvati →
          </p>
        </Link>

        <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-sm text-neutral-500 dark:border-neutral-700">
          <div className="mb-1 text-xs uppercase tracking-wide">
            Prossimamente (M12)
          </div>
          <div className="font-semibold text-neutral-700 dark:text-neutral-300">
            Marketing & neuromarketing
          </div>
          <p className="mt-1 text-xs">
            Neuro-score per ogni suggerimento, persona audience, campaign
            planner per le release.
          </p>
        </div>
      </div>

      <p className="text-xs text-neutral-500">
        💡 Tutti i prompt generati sono copiabili. Per le immagini usa{" "}
        <a
          href="https://claude.ai/design"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-600 hover:underline"
        >
          claude.ai/design
        </a>{" "}
        (sito web ufficiale Anthropic) o il tool che preferisci.
      </p>
    </div>
  );
}
