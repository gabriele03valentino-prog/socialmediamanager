"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CopyableBlock } from "@/components/CopyableBlock";

interface CoverBrief {
  title: string;
  brief: string;
  claudeDesignPrompt: string;
  mjPrompt: string;
  ideogramPrompt: string;
  createdAt?: string;
}

export function CoverBriefGenerator({ existing }: { existing: CoverBrief[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [releaseTitle, setReleaseTitle] = useState("");
  const [releaseType, setReleaseType] = useState<"singolo" | "ep" | "album">(
    "singolo",
  );
  const [mood, setMood] = useState("");
  const [story, setStory] = useState("");
  const [keywords, setKeywords] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = {
        releaseTitle,
        releaseType,
        mood,
        story,
        keywords: keywords
          .split(/[,\n]/)
          .map((k) => k.trim())
          .filter(Boolean),
      };
      const res = await fetch("/api/brand/cover-brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (json.ok) {
        setReleaseTitle("");
        setMood("");
        setStory("");
        setKeywords("");
        startTransition(() => router.refresh());
      } else {
        setError(json.error ?? "errore");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={submit}
        className="space-y-3 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Nuovo cover brief
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-neutral-500">Titolo release</label>
            <input
              value={releaseTitle}
              onChange={(e) => setReleaseTitle(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Tipo</label>
            <select
              value={releaseType}
              onChange={(e) =>
                setReleaseType(e.target.value as "singolo" | "ep" | "album")
              }
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
            >
              <option value="singolo">Singolo</option>
              <option value="ep">EP</option>
              <option value="album">Album</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Mood del brano</label>
          <input
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            required
            placeholder="es. malinconico + energico, notte d'estate"
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">
            Storia / cosa racconta
          </label>
          <textarea
            value={story}
            onChange={(e) => setStory(e.target.value)}
            required
            rows={3}
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">
            Parole evocative (2-5, separate da virgola)
          </label>
          <input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            required
            placeholder="es. silenzio, lampione, 3am"
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? "Genero… (20s)" : "Genera brief cover"}
          </button>
          {error ? <span className="text-xs text-rose-600">{error}</span> : null}
        </div>
      </form>

      {existing.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Cover brief recenti
          </h2>
          <ul className="space-y-4">
            {existing.map((c, i) => (
              <li
                key={i}
                className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <header className="flex items-center justify-between">
                  <h3 className="font-semibold">{c.title}</h3>
                  {c.createdAt ? (
                    <time className="text-xs text-neutral-500">
                      {new Date(c.createdAt).toLocaleDateString("it-IT")}
                    </time>
                  ) : null}
                </header>
                <p className="text-sm text-neutral-700 dark:text-neutral-300">
                  {c.brief}
                </p>
                <div className="grid gap-2 md:grid-cols-3">
                  <CopyableBlock
                    label="Claude Design"
                    text={c.claudeDesignPrompt}
                  />
                  <CopyableBlock label="Midjourney" text={c.mjPrompt} />
                  <CopyableBlock label="Ideogram" text={c.ideogramPrompt} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
