import { auth } from "@/auth";
import { CalendarGrid, type CalendarItem } from "@/components/CalendarGrid";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CalendarioPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // lunedì
  const end = new Date(start);
  end.setDate(end.getDate() + 28);

  const [suggestions, drafts] = await Promise.all([
    prisma.suggestion.findMany({
      where: {
        userId,
        status: "PROPOSED",
        forDate: { gte: start, lt: end },
      },
    }),
    prisma.draft.findMany({
      where: {
        userId,
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
      <header>
        <h1 className="text-2xl font-semibold">Calendario editoriale</h1>
        <p className="text-sm text-neutral-500">
          Le prossime 4 settimane. I <span className="text-pink-500">pallini</span>{" "}
          indicano la piattaforma; clicca un item per aprirlo.
        </p>
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
