"use client";

import type { Goal } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { GOAL_METRIC_LABEL, GOAL_STATUS_LABEL, type GoalProgress } from "@/lib/goals";
import { PLATFORM_LABEL } from "@/lib/utils";
import { GoalProgressChart } from "./GoalProgressChart";

type GoalRow = Goal & { progress: GoalProgress };

const STATUS_BADGE: Record<Goal["status"], string> = {
  ACTIVE: "bg-brand-50 text-brand-700 dark:bg-brand-700/20 dark:text-brand-100",
  ACHIEVED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-700/20 dark:text-emerald-100",
  EXPIRED: "bg-rose-50 text-rose-700 dark:bg-rose-700/20 dark:text-rose-100",
  ARCHIVED: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
};

export function GoalsView({ goals }: { goals: GoalRow[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useTransition();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          Definisci traguardi misurabili (es. 10.000 follower IG entro il
          31/12). Il sistema correla i tuoi snapshot quotidiani al target e ti
          dice se sei in linea.
        </p>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
        >
          + Nuovo obiettivo
        </button>
      </div>

      {creating ? (
        <NewGoalForm
          onCancel={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            setBusy(() => router.refresh());
          }}
        />
      ) : null}

      {goals.length === 0 && !creating ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 dark:border-neutral-700 dark:bg-neutral-900">
          <h2 className="text-base font-semibold">Nessun obiettivo ancora</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Aggiungi il primo: il valore di partenza è preso dal tuo ultimo
            snapshot, e ogni sync aggiorna la progressione automaticamente.
          </p>
        </div>
      ) : null}

      <ul className="space-y-4">
        {goals.map((goal) => (
          <li
            key={goal.id}
            className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                  <span className="rounded bg-brand-50 px-1.5 py-0.5 text-brand-700 dark:bg-brand-700/20 dark:text-brand-100">
                    {PLATFORM_LABEL[goal.platform] ?? goal.platform}
                  </span>
                  <span>{GOAL_METRIC_LABEL[goal.metric]}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 ${STATUS_BADGE[goal.status]}`}
                  >
                    {GOAL_STATUS_LABEL[goal.status]}
                  </span>
                  {goal.targetDate ? (
                    <span>
                      entro {new Date(goal.targetDate).toISOString().slice(0, 10)}
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-1 text-lg font-semibold">
                  {goal.targetValue.toLocaleString("it-IT")}{" "}
                  <span className="text-sm font-normal text-neutral-500">
                    {GOAL_METRIC_LABEL[goal.metric].toLowerCase()}
                  </span>
                </h3>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (!confirm("Eliminare questo obiettivo?")) return;
                  const res = await fetch(`/api/goals/${goal.id}`, {
                    method: "DELETE",
                  });
                  if (!res.ok) {
                    const j = (await res.json().catch(() => ({}))) as {
                      error?: string;
                    };
                    alert(`Eliminazione fallita: ${j.error ?? res.status}`);
                    return;
                  }
                  setBusy(() => router.refresh());
                }}
                className="text-xs text-rose-600 hover:underline disabled:opacity-50"
              >
                Elimina
              </button>
            </div>

            <ProgressBar progress={goal.progress} />

            <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-neutral-500 sm:grid-cols-4">
              <Stat
                label="Attuale"
                value={goal.progress.current.toLocaleString("it-IT")}
              />
              <Stat
                label="Da fare"
                value={goal.progress.remaining.toLocaleString("it-IT")}
              />
              <Stat
                label="Giorni rimasti"
                value={goal.progress.daysLeft === null ? "—" : `${goal.progress.daysLeft}`}
              />
              <Stat
                label="Trend"
                value={
                  goal.progress.projection === null
                    ? "—"
                    : `${goal.progress.projection.toLocaleString("it-IT")} ${
                        goal.progress.onTrack ? "✅" : "⚠️"
                      }`
                }
              />
            </div>

            <div className="mt-4">
              <GoalProgressChart
                series={goal.progress.series}
                target={goal.targetValue}
                startValue={goal.startValue}
                label={GOAL_METRIC_LABEL[goal.metric]}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-neutral-50 px-3 py-2 dark:bg-neutral-800">
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        {value}
      </div>
    </div>
  );
}

function ProgressBar({ progress }: { progress: GoalProgress }) {
  const filled = Math.min(progress.percent, 100);
  const overshoot = Math.max(0, progress.percent - 100);
  return (
    <div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className="h-full bg-brand-600"
          style={{ width: `${filled}%` }}
        />
        {overshoot > 0 ? (
          <div
            className="-mt-2.5 h-2.5 bg-emerald-500"
            style={{ width: `${Math.min(overshoot, 100)}%` }}
          />
        ) : null}
      </div>
      <div className="mt-1 text-xs text-neutral-500">
        {progress.percent}% del percorso (parti da{" "}
        {progress.start.toLocaleString("it-IT")})
      </div>
    </div>
  );
}

function NewGoalForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [platform, setPlatform] = useState("INSTAGRAM");
  const [metric, setMetric] = useState("FOLLOWERS");
  const [targetValue, setTargetValue] = useState("10000");
  const [targetDate, setTargetDate] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setErr(null);
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        platform,
        metric,
        targetValue: Number(targetValue),
        targetDate: targetDate || undefined,
        note: note || undefined,
      }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(j.error ?? `Errore ${res.status}`);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    onCreated();
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="text-base font-semibold">Nuovo obiettivo</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Piattaforma">
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          >
            <option value="INSTAGRAM">Instagram</option>
            <option value="TIKTOK">TikTok</option>
            <option value="YOUTUBE">YouTube</option>
            <option value="SPOTIFY">Spotify</option>
            <option value="FACEBOOK">Facebook</option>
          </select>
        </Field>
        <Field label="Metrica">
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          >
            <option value="FOLLOWERS">Follower</option>
            <option value="AVG_VIEWS">Views medie (ultimi 20 post)</option>
            <option value="AVG_REACH">Reach medio</option>
            <option value="MONTHLY_LISTENERS">Ascoltatori mensili (manuale)</option>
          </select>
        </Field>
        <Field label="Valore target">
          <input
            type="number"
            min={1}
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          />
        </Field>
        <Field label="Entro il (opzionale)">
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          />
        </Field>
        <Field label="Nota (opzionale)" full>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="es. promesso ai fan al concerto del 12/02"
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          />
        </Field>
      </div>

      {err ? <p className="mt-3 text-xs text-rose-600">{err}</p> : null}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? "Salvo…" : "Crea"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
        >
          Annulla
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
