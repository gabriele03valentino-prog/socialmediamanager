"use client";

import type { PostMortem } from "@prisma/client";
import { useState } from "react";
import { PostMortemCard } from "@/components/PostMortemCard";

interface LearningsTabsProps {
  all: PostMortem[];
  top: PostMortem[];
  flop: PostMortem[];
}

type TabKey = "ALL" | "TOP" | "FLOP";

const TAB_LABEL: Record<TabKey, string> = {
  ALL: "Tutti",
  TOP: "Top performer",
  FLOP: "Flop",
};

export function LearningsTabs({ all, top, flop }: LearningsTabsProps) {
  const [tab, setTab] = useState<TabKey>("ALL");

  const groups: Record<TabKey, PostMortem[]> = {
    ALL: all,
    TOP: top,
    FLOP: flop,
  };
  const current = groups[tab];

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        className="flex gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800"
      >
        {(["ALL", "TOP", "FLOP"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              tab === k
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-900 dark:text-neutral-100"
                : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100"
            }`}
          >
            {TAB_LABEL[k]} ({groups[k].length})
          </button>
        ))}
      </div>

      {current.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center dark:border-neutral-700 dark:bg-neutral-900">
          <p className="text-sm text-neutral-500">
            Nessun post-mortem in questa categoria. Aspetta che il cron analizzi
            i prossimi post (48-72h dopo la pubblicazione).
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {current.map((m) => (
            <PostMortemCard key={m.id} mortem={m} />
          ))}
        </ul>
      )}
    </div>
  );
}
