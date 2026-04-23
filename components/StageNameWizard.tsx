"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { HandleStatus } from "@/lib/handle-check";

interface Idea {
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
};

export function StageNameWizard({
  initialIdeas,
}: {
  initialIdeas: Idea[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [keywordsText, setKeywordsText] = useState("");
  const [initials, setInitials] = useState("");
  const [language, setLanguage] = useState<
    "italiano" | "inglese" | "misto" | "onomatopeico"
  >("misto");
  const [count, setCount] = useState(12);
  const [ideas, setIdeas] = useState<Idea[]>(initialIdeas);
  const [loading, setLoading] = useState(false);
  const [choosingId, setChoosingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/brand/stage-names", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          keywords: keywordsText
            .split(/[,\n]/)
            .map((k) => k.trim())
            .filter(Boolean),
          initials: initials || undefined,
          language,
          count,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        ideas?: Idea[];
        error?: string;
      };
      if (json.ok && json.ideas) {
        setIdeas([...json.ideas, ...ideas]);
      } else {
        setError(json.error ?? "generazione fallita");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function choose(id: string) {
    setChoosingId(id);
    try {
      const res = await fetch(`/api/brand/stage-names/${id}/choose`, {
        method: "POST",
      });
      if (res.ok) {
        startTransition(() => router.refresh());
      }
    } finally {
      setChoosingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={generate}
        className="space-y-4 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div>
          <label className="block text-sm font-medium">Parole chiave</label>
          <input
            value={keywordsText}
            onChange={(e) => setKeywordsText(e.target.value)}
            placeholder="es. notturno, 808, milano, neon, spazio"
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Separate da virgole. Più sono evocative meglio è.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium">Iniziali (opz.)</label>
            <input
              value={initials}
              onChange={(e) => setInitials(e.target.value)}
              maxLength={4}
              placeholder="es. GV"
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Lingua</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as typeof language)}
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
            >
              <option value="italiano">Italiano</option>
              <option value="inglese">Inglese</option>
              <option value="misto">Misto</option>
              <option value="onomatopeico">Onomatopeico</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Numero proposte</label>
            <input
              type="number"
              min={5}
              max={20}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? "Genero… (15-25s)" : "Genera proposte"}
          </button>
          {error ? (
            <span className="text-xs text-rose-600">{error}</span>
          ) : null}
        </div>
      </form>

      {ideas.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Proposte ({ideas.length})
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {ideas.map((idea) => (
              <li
                key={idea.id}
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
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
                    {(["instagram", "tiktok", "spotify"] as const).map((p) => {
                      const s = idea.availability![p];
                      const chip = STATUS_CHIP[s];
                      return (
                        <span
                          key={p}
                          className={`rounded px-1.5 py-0.5 ${chip.cls}`}
                        >
                          {p.toUpperCase()} · {chip.label}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-3 text-[10px] text-neutral-400">
                    disponibilità non verificata
                  </div>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => choose(idea.id)}
                    disabled={choosingId !== null || idea.chosen}
                    className="rounded-md bg-brand-600 px-3 py-1.5 text-xs text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    {choosingId === idea.id
                      ? "…"
                      : idea.chosen
                        ? "Già scelto"
                        : "Scegli questo nome"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
