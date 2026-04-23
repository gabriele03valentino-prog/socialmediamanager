import Link from "next/link";
import { auth } from "@/auth";
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
  const session = await auth();
  if (!session?.user?.id) return null;

  const drafts = await prisma.draft.findMany({
    where: { userId: session.user.id },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Bozze</h1>
        <p className="text-sm text-neutral-500">
          Contenuti accettati dai suggerimenti. Clicca una bozza per modificarla e
          copiare caption + hashtag pronti per incollarli sull'app social.
        </p>
      </header>

      {drafts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
          Nessuna bozza ancora. Vai in{" "}
          <Link href="/suggerimenti" className="text-brand-600 underline">
            Suggerimenti
          </Link>{" "}
          e accettane uno.
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
