"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function GeneratePersonasButton({ hasExisting }: { hasExisting: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (
      hasExisting &&
      !confirm("Rigenerare le persona sovrascriverà quelle esistenti. Procedere?")
    )
      return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/marketing/persona", { method: "POST" });
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
    <div className="flex items-center gap-3">
      <button
        onClick={generate}
        disabled={loading}
        className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {loading
          ? "Genero… (30-45s)"
          : hasExisting
            ? "Rigenera persona"
            : "Genera persona"}
      </button>
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </div>
  );
}
