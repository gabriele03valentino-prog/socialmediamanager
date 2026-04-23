"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function SyncButton() {
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  async function sync() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/metrics/sync", { method: "POST" });
      const json = (await res.json()) as {
        ok?: boolean;
        results?: Array<{ platform: string; metrics?: boolean; posts?: number; error?: string }>;
      };
      if (json.ok && json.results) {
        const ok = json.results.filter((r) => !r.error).length;
        setMsg(`✓ sincronizzati ${ok}/${json.results.length} account`);
        startTransition(() => router.refresh());
      } else {
        setMsg("sync non riuscito");
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
        onClick={sync}
        disabled={loading}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
      >
        {loading ? "Sincronizzo…" : "Sincronizza ora"}
      </button>
      {msg ? <span className="text-xs text-neutral-500">{msg}</span> : null}
    </div>
  );
}
