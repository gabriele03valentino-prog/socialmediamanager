"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function GeneratePlanButton() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function generate() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/suggestions/generate", { method: "POST" });
      const json = (await res.json()) as { ok?: boolean; created?: number; error?: string };
      if (json.ok) {
        setMsg(`✓ ${json.created} suggerimenti generati`);
        startTransition(() => router.refresh());
      } else {
        setMsg(json.error ?? "errore");
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "errore");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={generate}
        disabled={loading}
        className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {loading ? "Genero… (può volerci 20-30s)" : "Genera piano settimanale"}
      </button>
      {msg ? <span className="text-xs text-neutral-500">{msg}</span> : null}
    </div>
  );
}
