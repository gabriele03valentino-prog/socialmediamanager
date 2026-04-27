"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  type IdeaWithAvailability,
  StageNameIdeaCard,
} from "./StageNameIdeaCard";

export type Idea = IdeaWithAvailability;

export function StageNameWizard({ initialIdeas }: { initialIdeas: Idea[] }) {
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? "Genero… (15-25s)" : "Genera proposte"}
          </button>
          {error ? <span className="text-xs text-rose-600">{error}</span> : null}
        </div>
      </form>

      {ideas.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Proposte ({ideas.length})
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {ideas.map((idea) => (
              <StageNameIdeaCard
                key={idea.id}
                idea={idea}
                choosing={choosingId === idea.id}
                onChoose={() => choose(idea.id)}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
