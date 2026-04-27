import Link from "next/link";
import type { Platform } from "@prisma/client";
import { PLATFORM_LABEL } from "@/lib/utils";

export interface CalendarItem {
  id: string;
  kind: "suggestion" | "draft";
  date: Date;
  time?: string | null;
  platform: Platform;
  contentType: string;
  label: string;
  status: string;
  href: string;
}

const DAY_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

const PLATFORM_DOT: Record<Platform, string> = {
  INSTAGRAM: "bg-pink-500",
  FACEBOOK: "bg-blue-600",
  TIKTOK: "bg-black dark:bg-white",
  YOUTUBE: "bg-red-600",
  SPOTIFY: "bg-green-500",
};

function startOfWeek(d: Date): Date {
  const day = (d.getDay() + 6) % 7; // lun=0
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(d.getDate() - day);
  return out;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function CalendarGrid({
  items,
  weeks = 4,
}: {
  items: CalendarItem[];
  weeks?: number;
}) {
  const today = new Date();
  const start = startOfWeek(today);
  const days: Date[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }

  const byDate = new Map<string, CalendarItem[]>();
  for (const it of items) {
    const key = it.date.toISOString().slice(0, 10);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(it);
  }

  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);

  return (
    <>
      {/* Vista desktop: griglia 7 colonne */}
      <div className="hidden overflow-hidden rounded-xl border border-neutral-200 bg-white md:block dark:border-neutral-800 dark:bg-neutral-900">
        <div className="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950">
          {DAY_LABELS.map((l) => (
            <div key={l} className="px-2 py-2 text-center">
              {l}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const key = d.toISOString().slice(0, 10);
            const list = byDate.get(key) ?? [];
            const isToday = sameDay(d, today);
            const isPast = d.getTime() < todayStart.getTime() && !isToday;
            return (
              <div
                key={key}
                className={`min-h-[100px] border-b border-r border-neutral-200 p-2 dark:border-neutral-800 ${
                  isPast ? "bg-neutral-50/50 dark:bg-neutral-950/40" : ""
                }`}
              >
                <div
                  className={`mb-1 text-xs ${
                    isToday
                      ? "inline-block rounded-full bg-brand-600 px-1.5 py-0.5 text-white"
                      : "text-neutral-500"
                  }`}
                >
                  {d.getDate()}
                </div>
                <div className="space-y-1">
                  {list.map((it) => (
                    <Link
                      key={`${it.kind}-${it.id}`}
                      href={it.href}
                      className="flex items-center gap-1.5 rounded border border-neutral-200 bg-neutral-50 px-1.5 py-1 text-[11px] hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                      title={it.label}
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${PLATFORM_DOT[it.platform]}`}
                      />
                      <span className="flex-1 truncate">{it.label}</span>
                      {it.time ? (
                        <span className="shrink-0 text-neutral-500">{it.time}</span>
                      ) : null}
                    </Link>
                  ))}
                </div>
                <span className="sr-only">
                  {PLATFORM_LABEL[list[0]?.platform ?? "INSTAGRAM"]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Vista mobile: agenda verticale, mostra solo giorni con eventi */}
      <div className="space-y-2 md:hidden">
        {days
          .filter((d) => (byDate.get(d.toISOString().slice(0, 10)) ?? []).length > 0)
          .map((d) => {
            const key = d.toISOString().slice(0, 10);
            const list = byDate.get(key) ?? [];
            const isToday = sameDay(d, today);
            const isPast = d.getTime() < todayStart.getTime() && !isToday;
            return (
              <section
                key={key}
                className={`rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900 ${
                  isPast ? "opacity-60" : ""
                }`}
              >
                <div className="mb-2 flex items-baseline justify-between">
                  <span
                    className={`text-sm font-semibold ${
                      isToday ? "text-brand-600" : "text-neutral-700 dark:text-neutral-200"
                    }`}
                  >
                    {DAY_LABELS[(d.getDay() + 6) % 7]} {d.getDate()}/
                    {String(d.getMonth() + 1).padStart(2, "0")}
                    {isToday ? " · oggi" : ""}
                  </span>
                  <span className="text-xs text-neutral-500">{list.length} item</span>
                </div>
                <ul className="space-y-1.5">
                  {list.map((it) => (
                    <li key={`${it.kind}-${it.id}`}>
                      <Link
                        href={it.href}
                        className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                      >
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${PLATFORM_DOT[it.platform]}`}
                        />
                        <span className="flex-1 truncate">{it.label}</span>
                        {it.time ? (
                          <span className="shrink-0 text-xs text-neutral-500">
                            {it.time}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        {days.every((d) => (byDate.get(d.toISOString().slice(0, 10)) ?? []).length === 0) ? (
          <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
            Nessun item nelle prossime {weeks} settimane.
          </div>
        ) : null}
      </div>
    </>
  );
}
