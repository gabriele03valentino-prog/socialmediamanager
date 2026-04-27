"use client";

import { type HandleStatus, manualCheckUrl } from "@/lib/handle-check";

export interface IdeaWithAvailability {
  id: string;
  name: string;
  rationale: string;
  availability: {
    instagram: HandleStatus;
    tiktok: HandleStatus;
    spotify: HandleStatus;
  } | null;
  chosen: boolean;
}

const STATUS_CHIP: Record<HandleStatus, { label: string; cls: string }> = {
  free: {
    label: "libero",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
  },
  taken: {
    label: "occupato",
    cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200",
  },
  unknown: {
    label: "da verificare",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
  },
  manual: {
    label: "verifica ↗",
    cls: "bg-sky-100 text-sky-700 hover:bg-sky-200 dark:bg-sky-900/40 dark:text-sky-200",
  },
};

export function StageNameIdeaCard({
  idea,
  choosing,
  onChoose,
}: {
  idea: IdeaWithAvailability;
  choosing: boolean;
  onChoose: () => void;
}) {
  return (
    <li
      className={`rounded-xl border p-4 ${
        idea.chosen
          ? "border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-700/20"
          : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-xl font-bold">{idea.name}</h3>
        {idea.chosen ? (
          <span className="rounded bg-brand-600 px-2 py-0.5 text-xs text-white">
            Scelto
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
        {idea.rationale}
      </p>
      {idea.availability ? (
        <AvailabilityChips name={idea.name} availability={idea.availability} />
      ) : (
        <div className="mt-3 text-[10px] text-neutral-400">
          disponibilità non verificata
        </div>
      )}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onChoose}
          disabled={choosing || idea.chosen}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-xs text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {choosing ? "…" : idea.chosen ? "Già scelto" : "Scegli questo nome"}
        </button>
      </div>
    </li>
  );
}

function AvailabilityChips({
  name,
  availability,
}: {
  name: string;
  availability: NonNullable<IdeaWithAvailability["availability"]>;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
      {(["instagram", "tiktok", "spotify"] as const).map((p) => {
        const s = availability[p];
        const chip = STATUS_CHIP[s];
        const label = `${p.toUpperCase()} · ${chip.label}`;
        if (s === "manual" && (p === "instagram" || p === "tiktok")) {
          return (
            <a
              key={p}
              href={manualCheckUrl(p, name)}
              target="_blank"
              rel="noopener noreferrer"
              className={`rounded px-1.5 py-0.5 transition-colors ${chip.cls}`}
              title={`Apri ${p} per verificare`}
            >
              {label}
            </a>
          );
        }
        return (
          <span key={p} className={`rounded px-1.5 py-0.5 ${chip.cls}`}>
            {label}
          </span>
        );
      })}
    </div>
  );
}
