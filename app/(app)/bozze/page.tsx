import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PLATFORM_LABEL } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BozzePage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const drafts = await prisma.draft.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Bozze</h1>
        <p className="text-sm text-neutral-500">
          Contenuti accettati dai suggerimenti. Modificali e copiali quando sei
          pronto a pubblicarli manualmente.
        </p>
      </header>

      {drafts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
          Nessuna bozza ancora. Accetta un suggerimento per creare la prima.
        </div>
      ) : (
        <ul className="space-y-3">
          {drafts.map((d) => (
            <li
              key={d.id}
              className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="mb-2 flex items-center gap-2 text-xs text-neutral-500">
                <span className="rounded bg-brand-50 px-1.5 py-0.5 text-brand-700 dark:bg-brand-700/20 dark:text-brand-100">
                  {PLATFORM_LABEL[d.platform] ?? d.platform}
                </span>
                <span>{d.contentType}</span>
                <span>·</span>
                <span className="uppercase">{d.status.toLowerCase()}</span>
                {d.scheduledFor ? (
                  <>
                    <span>·</span>
                    <time>{d.scheduledFor.toISOString().slice(0, 16).replace("T", " ")}</time>
                  </>
                ) : null}
              </div>
              <p className="whitespace-pre-line text-sm">{d.caption}</p>
              {d.hashtags.length > 0 && (
                <p className="mt-2 text-xs text-brand-700 dark:text-brand-200">
                  {d.hashtags.map((h) => `#${h}`).join(" ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
