import { redirect } from "next/navigation";
import { CalendarGrid, type CalendarItem } from "@/components/CalendarGrid";
import { getActiveProject } from "@/lib/active-project";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CalendarioPage() {
  const project = await getActiveProject();
  if (!project) redirect("/progetti?create=1");

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // lunedì
  const end = new Date(start);
  end.setDate(end.getDate() + 28);

  const [suggestions, drafts] = await Promise.all([
    prisma.suggestion.findMany({
      where: {
        projectId: project.id,
        status: "PROPOSED",
        forDate: { gte: start, lt: end },
      },
    }),
    prisma.draft.findMany({
      where: {
        projectId: project.id,
        status: { in: ["TODO", "READY", "PUBLISHED"] },
        scheduledFor: { gte: start, lt: end },
      },
    }),
  ]);

  const items: CalendarItem[] = [
    ...suggestions.map<CalendarItem>((s) => ({
      id: s.id,
      kind: "suggestion",
      date: s.forDate,
      time: s.suggestedTime,
      platform: s.platform,
      contentType: s.contentType,
      label: s.hook,
      status: s.status,
      href: `/suggerimenti#${s.id}`,
    })),
    ...drafts.map<CalendarItem>((d) => ({
      id: d.id,
      kind: "draft",
      date: d.scheduledFor ?? new Date(),
      time: d.scheduledFor?.toISOString().slice(11, 16),
      platform: d.platform,
      contentType: d.contentType,
      label: d.caption.slice(0, 60),
      status: d.status,
      href: `/bozze/${d.id}`,
    })),
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Calendario editoriale</h1>
          <p className="text-sm text-neutral-500">
            Le prossime 4 settimane. I <span className="text-pink-500">pallini</span>{" "}
            indicano la piattaforma; clicca un item per aprirlo.
          </p>
        </div>
        <a
          href="/api/export/calendar"
          className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
          title="Scarica calendario come .ics — sottoscrivibile su Google/Apple/Outlook"
        >
          ⬇ Esporta .ics
        </a>
      </header>

      <CalendarGrid items={items} />

      <div className="flex items-center gap-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-pink-500" /> Instagram
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-blue-600" /> Facebook
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-black dark:bg-white" /> TikTok
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-600" /> YouTube
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500" /> Spotify
        </span>
      </div>
    </div>
  );
}
