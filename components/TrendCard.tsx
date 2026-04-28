"use client";

import type { Trend } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PLATFORM_LABEL } from "@/lib/utils";
import { TrendKindBadge } from "./TrendKindBadge";

interface TrendCardProps {
  trend: Trend;
}

const STATUS_STYLE: Record<Trend["status"], string> = {
  ACTIVE: "bg-brand-50 text-brand-700 dark:bg-brand-700/20 dark:text-brand-100",
  WARMING: "bg-amber-50 text-amber-700 dark:bg-amber-700/20 dark:text-amber-100",
  EXPIRED: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
};

const STATUS_LABEL: Record<Trend["status"], string> = {
  ACTIVE: "Attivo",
  WARMING: "Emergente",
  EXPIRED: "Scaduto",
};

function formatCountdown(expiresAt: Date | null): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "scaduto";
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  if (days === 1) return "scade domani";
  return `scade fra ${days} giorni`;
}

export function TrendCard({ trend }: TrendCardProps) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const countdown = formatCountdown(trend.expiresAt);

  async function patchStatus(status: "ACTIVE" | "EXPIRED") {
    setErr(null);
    const res = await fetch(`/api/trends/${trend.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(j.error ?? `Errore ${res.status}`);
      return;
    }
    startTransition(() => router.refresh());
  }

  async function deleteTrend() {
    if (!confirm(`Eliminare il trend "${trend.name}"?`)) return;
    setErr(null);
    const res = await fetch(`/api/trends/${trend.id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(j.error ?? `Errore ${res.status}`);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <li className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <TrendKindBadge kind={trend.kind} />
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[trend.status]}`}
          >
            {STATUS_LABEL[trend.status]}
          </span>
          {trend.generatedBy && trend.generatedBy !== "manual" ? (
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-700/20 dark:text-violet-100">
              AI
            </span>
          ) : null}
        </div>
        {countdown ? (
          <span className="text-xs text-neutral-500">{countdown}</span>
        ) : null}
      </div>

      <h3 className="mt-2 text-base font-semibold">{trend.name}</h3>
      {trend.description ? (
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
          {trend.description}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {trend.platforms.map((p) => (
          <span
            key={p}
            className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
          >
            {PLATFORM_LABEL[p] ?? p}
          </span>
        ))}
      </div>

      {trend.sourceUrl ? (
        <a
          href={trend.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs text-brand-700 hover:underline dark:text-brand-300"
        >
          Apri fonte ↗
        </a>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {trend.status !== "ACTIVE" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => patchStatus("ACTIVE")}
            className="rounded-md border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs text-brand-700 hover:bg-brand-100 disabled:opacity-50 dark:border-brand-700 dark:bg-brand-700/20 dark:text-brand-100"
          >
            Attiva
          </button>
        ) : null}
        {trend.status !== "EXPIRED" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => patchStatus("EXPIRED")}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
          >
            Marca scaduto
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={deleteTrend}
          className="ml-auto text-xs text-rose-600 hover:underline disabled:opacity-50"
        >
          Elimina
        </button>
      </div>

      {err ? <p className="mt-2 text-xs text-rose-600">{err}</p> : null}
    </li>
  );
}
