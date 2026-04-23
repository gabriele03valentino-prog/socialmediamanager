"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CampaignForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"singolo" | "ep" | "album" | "live" | "merch">(
    "singolo",
  );
  const [releaseDate, setReleaseDate] = useState("");
  const [preSaveUrl, setPreSaveUrl] = useState("");
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/marketing/campaign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          type,
          releaseDate,
          preSaveUrl: preSaveUrl || undefined,
          goal: goal || undefined,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        campaignId?: string;
        steps?: number;
        error?: string;
      };
      if (json.ok && json.campaignId) {
        router.push(`/marketing?created=${json.campaignId}&steps=${json.steps ?? 0}`);
      } else {
        setError(json.error ?? "generazione fallita");
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
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Titolo release</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="es. Notti in tangenziale"
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Tipo</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          >
            <option value="singolo">Singolo</option>
            <option value="ep">EP</option>
            <option value="album">Album</option>
            <option value="live">Live / evento</option>
            <option value="merch">Merch drop</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Data uscita</label>
          <input
            type="date"
            value={releaseDate}
            onChange={(e) => setReleaseDate(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Link pre-save (opz.)</label>
          <input
            type="url"
            value={preSaveUrl}
            onChange={(e) => setPreSaveUrl(e.target.value)}
            placeholder="https://distrokid.com/hyperfollow/..."
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">Obiettivo (opz.)</label>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={2}
          placeholder="es. 5000 ascoltatori mensili nel mese del drop, 1000 follower nuovi IG"
          className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Costruisco piano… (30-60s)" : "Genera campagna"}
        </button>
        {error ? <span className="text-xs text-rose-600">{error}</span> : null}
      </div>

      <p className="text-xs text-neutral-500">
        Verranno create 5-15 <strong>Suggestion</strong> distribuite su teaser → build
        → reveal → drop day → echo → post-release, accettabili come bozze dal
        calendario.
      </p>
    </form>
  );
}
