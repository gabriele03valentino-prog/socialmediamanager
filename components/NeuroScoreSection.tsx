"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  parseNeuroBreakdown,
  parseNeuroImprovements,
  type NeuroBreakdown,
  type NeuroScoreData,
} from "@/lib/ai/marketing/types";

export type { NeuroBreakdown, NeuroScoreData };

const DIM_LABELS: Record<keyof NeuroBreakdown, string> = {
  hookStrength: "Hook (V1/STS)",
  emotionalValence: "Emozione (amigdala)",
  noveltyBias: "Novelty (DA)",
  rewardPrediction: "Reward (NAcc)",
  socialSalience: "Social (mPFC)",
  curiosityGap: "Curiosità",
};

function scoreColor(score: number): string {
  if (score >= 75) return "bg-emerald-500";
  if (score >= 55) return "bg-amber-500";
  return "bg-rose-500";
}

function Bar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
      <div
        className="h-full bg-brand-600 transition-all"
        style={{ width: `${(value / 20) * 100}%` }}
      />
    </div>
  );
}

export function NeuroScoreSection({
  target,
  id,
  initial,
}: {
  target: "suggestion" | "draft";
  id: string;
  initial: NeuroScoreData | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [data, setData] = useState<NeuroScoreData | null>(initial);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const payload =
        target === "suggestion" ? { suggestionId: id } : { draftId: id };
      const res = await fetch("/api/marketing/score", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        neuroScore?: {
          score: number;
          breakdown: unknown;
          improvements: unknown;
        };
        summary?: string;
      };
      if (json.ok && json.neuroScore) {
        setData({
          score: json.neuroScore.score,
          breakdown: parseNeuroBreakdown(json.neuroScore.breakdown),
          improvements: parseNeuroImprovements(json.neuroScore.improvements),
        });
        setSummary(json.summary ?? null);
        setOpen(true);
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
    <div className="mt-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
      <div className="flex items-center gap-3">
        <button
          onClick={() => (data ? setOpen((o) => !o) : run())}
          disabled={loading}
          className="flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
        >
          {loading ? (
            <span>analisi…</span>
          ) : data ? (
            <>
              <span
                className={`inline-block h-2 w-2 rounded-full ${scoreColor(data.score)}`}
              />
              <span>
                Neuro-score <strong>{data.score}</strong>/100
              </span>
              <span className="text-neutral-400">{open ? "▴" : "▾"}</span>
            </>
          ) : (
            <span>🧠 Analisi neuromarketing</span>
          )}
        </button>
        {data ? (
          <button
            onClick={run}
            disabled={loading}
            className="text-xs text-neutral-500 hover:underline disabled:opacity-50"
          >
            rianalizza
          </button>
        ) : null}
        {error ? <span className="text-xs text-rose-600">{error}</span> : null}
      </div>

      {open && data ? (
        <div className="mt-3 space-y-3 rounded-lg bg-neutral-50 p-3 dark:bg-neutral-950">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-3">
            {(Object.keys(DIM_LABELS) as Array<keyof NeuroBreakdown>).map((k) => (
              <div key={k}>
                <div className="flex items-baseline justify-between text-[11px]">
                  <span className="text-neutral-600 dark:text-neutral-400">
                    {DIM_LABELS[k]}
                  </span>
                  <span className="font-mono text-neutral-700 dark:text-neutral-300">
                    {data.breakdown[k]}/20
                  </span>
                </div>
                <Bar value={data.breakdown[k]} />
              </div>
            ))}
          </div>

          {summary ? (
            <p className="text-xs text-neutral-600 dark:text-neutral-400">{summary}</p>
          ) : null}

          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Miglioramenti suggeriti
            </div>
            <ul className="space-y-1 text-xs">
              {data.improvements.map((s, i) => (
                <li
                  key={i}
                  className="flex gap-2 rounded border-l-2 border-brand-500 bg-white px-2 py-1 dark:bg-neutral-900"
                >
                  <span className="text-brand-600">→</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[10px] text-neutral-400">
            Stima neuromarketing ispirata ai segnali brain-predictive di{" "}
            <a
              href="https://github.com/facebookresearch/tribev2"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              TRIBE v2 (Meta AI)
            </a>
            , non una chiamata al modello reale.
          </p>
        </div>
      ) : null}
    </div>
  );
}
