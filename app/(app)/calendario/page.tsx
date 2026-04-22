import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PLATFORM_LABEL } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CalendarioPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [suggestions, drafts] = await Promise.all([
    prisma.suggestion.findMany({
      where: { userId: session.user.id, status: "PROPOSED" },
      orderBy: { forDate: "asc" },
    }),
    prisma.draft.findMany({
      where: { userId: session.user.id, status: { in: ["TODO", "READY"] } },
      orderBy: { scheduledFor: "asc" },
    }),
  ]);

  const items = [
    ...suggestions.map((s) => ({
      when: s.forDate,
      time: s.suggestedTime,
      kind: "suggerimento" as const,
      label: s.hook,
      platform: s.platform,
      status: s.status,
    })),
    ...drafts.map((d) => ({
      when: d.scheduledFor ?? new Date(),
      time: null,
      kind: "bozza" as const,
      label: d.caption.slice(0, 80),
      platform: d.platform,
      status: d.status,
    })),
  ].sort((a, b) => a.when.getTime() - b.when.getTime());

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Calendario editoriale</h1>
          <p className="text-sm text-neutral-500">
            Suggerimenti pendenti e bozze in corso di produzione.
          </p>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
          Niente in calendario. Genera i primi suggerimenti dalla Dashboard.
        </div>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
          {items.map((it, i) => (
            <li key={i} className="flex items-center gap-4 p-4">
              <div className="w-28 text-sm text-neutral-500">
                <div>{it.when.toISOString().slice(0, 10)}</div>
                {it.time ? <div className="text-xs">{it.time}</div> : null}
              </div>
              <span className="inline-flex rounded bg-brand-50 px-2 py-0.5 text-xs text-brand-700 dark:bg-brand-700/20 dark:text-brand-100">
                {PLATFORM_LABEL[it.platform] ?? it.platform}
              </span>
              <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs uppercase text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                {it.kind}
              </span>
              <div className="flex-1 truncate text-sm">{it.label}</div>
              <span className="text-xs text-neutral-400">{it.status}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-neutral-400">
        M7 ⟶ questa pagina userà FullCalendar con drag &amp; drop e pannelli laterali.
      </p>
    </div>
  );
}
