import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveProject } from "@/lib/active-project";
import { prisma } from "@/lib/db";
import { PLATFORM_LABEL } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  TODO: "Da fare",
  READY: "Pronta",
  PUBLISHED: "Pubblicata",
  ARCHIVED: "Archiviata",
};

export default async function BozzePage() {
  const project = await getActiveProject();
  if (!project) redirect("/onboarding");

  const drafts = await prisma.draft.findMany({
    where: { projectId: project.id },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Bozze</h1>
          <p className="text-sm text-neutral-500">
            Contenuti accettati dai suggerimenti. Clicca una bozza per modificarla e
            copiare caption + hashtag pronti per incollarli sull'app social.
          </p>
        </div>
        {drafts.length > 0 ? (
          <a
            href="/api/export/drafts?format=csv"
            className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
          >
            ⬇ Esporta CSV
          </a>
        ) : null}
      </header>

      {drafts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 dark:border-neutral-700 dark:bg-neutral-900">
          <h2 className="text-base font-semibold">Nessuna bozza ancora</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Le bozze nascono dai suggerimenti che accetti. Da qui le rifinisci e copi
            caption + hashtag pronti da incollare nelle app social.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/suggerimenti"
              className="inline-flex items-center rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
            >
              Vai ai suggerimenti
            </Link>
            <Link
              href="/calendario"
              className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
            >
              Apri calendario
            </Link>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
          {drafts.map((d) => (
            <li key={d.id}>
              <Link
                href={`/bozze/${d.id}`}
                className="block p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                <div className="mb-1 flex items-center gap-2 text-xs text-neutral-500">
                  <span className="rounded bg-brand-50 px-1.5 py-0.5 text-brand-700 dark:bg-brand-700/20 dark:text-brand-100">
                    {PLATFORM_LABEL[d.platform] ?? d.platform}
                  </span>
                  <span>{d.contentType}</span>
                  <span>·</span>
                  <span
                    className={
                      d.status === "READY"
                        ? "text-emerald-600"
                        : d.status === "PUBLISHED"
                          ? "text-neutral-400"
                          : "text-neutral-600"
                    }
                  >
                    {STATUS_LABEL[d.status] ?? d.status}
                  </span>
                  {d.scheduledFor ? (
                    <>
                      <span>·</span>
                      <time>
                        {d.scheduledFor.toISOString().slice(0, 16).replace("T", " ")}
                      </time>
                    </>
                  ) : null}
                </div>
                <p className="line-clamp-2 text-sm">{d.caption}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
