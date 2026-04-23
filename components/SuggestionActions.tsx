"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function SuggestionActions({ id }: { id: string }) {
  const [loading, setLoading] = useState<"accept" | "reject" | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function act(kind: "accept" | "reject") {
    setLoading(kind);
    try {
      const res = await fetch(`/api/suggestions/${id}/${kind}`, { method: "POST" });
      if (res.ok) {
        startTransition(() => router.refresh());
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mt-4 flex items-center gap-2">
      <button
        onClick={() => act("accept")}
        disabled={loading !== null}
        className="rounded-md bg-brand-600 px-3 py-1.5 text-xs text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {loading === "accept" ? "…" : "Accetta → Bozza"}
      </button>
      <button
        onClick={() => act("reject")}
        disabled={loading !== null}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
      >
        {loading === "reject" ? "…" : "Scarta"}
      </button>
    </div>
  );
}
