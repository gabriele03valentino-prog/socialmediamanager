"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function BrandIdentityGenerator({ hasExisting }: { hasExisting: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [mood, setMood] = useState("");
  const [refs, setRefs] = useState("");
  const [colors, setColors] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = {
        moodKeywords: mood
          .split(/[,\n]/)
          .map((s) => s.trim())
          .filter(Boolean),
        referenceArtists: refs
          .split(/[,\n]/)
          .map((s) => s.trim())
          .filter(Boolean),
        favoriteColors: colors
          .split(/[,\n]/)
          .map((s) => s.trim())
          .filter(Boolean),
      };
      const res = await fetch("/api/brand/generate-identity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (json.ok) {
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
    <form
      onSubmit={submit}
      className="space-y-4 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {hasExisting ? "Rigenera identità" : "Genera identità visiva"}
      </h2>
      <div>
        <label className="block text-sm font-medium">Mood keywords (opz.)</label>
        <input
          value={mood}
          onChange={(e) => setMood(e.target.value)}
          placeholder="es. dark, minimal, warm, analogico, underground"
          className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">
          Artisti di riferimento (opz.)
        </label>
        <input
          value={refs}
          onChange={(e) => setRefs(e.target.value)}
          placeholder="es. Marracash, Travis Scott, Billie Eilish"
          className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Colori preferiti (opz.)</label>
        <input
          value={colors}
          onChange={(e) => setColors(e.target.value)}
          placeholder="es. bordeaux, nero, oro"
          className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading
            ? "Genero… (30-60s)"
            : hasExisting
              ? "Rigenera"
              : "Genera identità"}
        </button>
        {hasExisting ? (
          <span className="text-xs text-neutral-500">
            La nuova identità sostituirà quella esistente.
          </span>
        ) : null}
        {error ? <span className="text-xs text-rose-600">{error}</span> : null}
      </div>
    </form>
  );
}
