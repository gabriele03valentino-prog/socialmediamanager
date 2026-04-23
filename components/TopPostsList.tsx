import Link from "next/link";
import type { Platform } from "@prisma/client";
import { PLATFORM_LABEL } from "@/lib/utils";

export interface TopPostItem {
  id: string;
  platform: Platform;
  postedAt: Date;
  caption: string | null;
  permalink: string | null;
  likes: number | null;
  comments: number | null;
  views: number | null;
  reach: number | null;
  engagement: number;
  mediaType: string;
}

export function TopPostsList({ posts }: { posts: TopPostItem[] }) {
  if (posts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
        Nessun post sincronizzato negli ultimi 30 giorni.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
      {posts.map((p) => (
        <li key={p.id} className="flex items-start gap-4 p-4">
          <div className="w-20 shrink-0 text-xs text-neutral-500">
            <div>{p.postedAt.toISOString().slice(0, 10)}</div>
            <div className="mt-0.5 inline-flex rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              {p.mediaType}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2 text-xs">
              <span className="rounded bg-brand-50 px-1.5 py-0.5 text-brand-700 dark:bg-brand-700/20 dark:text-brand-100">
                {PLATFORM_LABEL[p.platform] ?? p.platform}
              </span>
              <span className="text-neutral-500">
                eng. {p.engagement.toLocaleString("it-IT")}
              </span>
            </div>
            <p className="line-clamp-2 text-sm text-neutral-800 dark:text-neutral-200">
              {p.caption ?? <em className="text-neutral-400">(nessun testo)</em>}
            </p>
            <div className="mt-1 flex items-center gap-3 text-xs text-neutral-500">
              {p.likes !== null ? <span>❤ {p.likes.toLocaleString("it-IT")}</span> : null}
              {p.comments !== null ? <span>💬 {p.comments}</span> : null}
              {p.views !== null ? <span>👀 {p.views.toLocaleString("it-IT")}</span> : null}
              {p.reach !== null ? (
                <span>reach {p.reach.toLocaleString("it-IT")}</span>
              ) : null}
              {p.permalink ? (
                <Link
                  href={p.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 hover:underline"
                >
                  apri ↗
                </Link>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
