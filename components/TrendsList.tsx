"use client";

import type { Trend } from "@prisma/client";
import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { TrendCard } from "./TrendCard";

interface TrendsListProps {
  active: Trend[];
  warming: Trend[];
  expired: Trend[];
}

type TabKey = "ACTIVE" | "WARMING" | "EXPIRED";

const TAB_LABEL: Record<TabKey, string> = {
  ACTIVE: "Attivi",
  WARMING: "Emergenti",
  EXPIRED: "Scaduti",
};

export function TrendsList({ active, warming, expired }: TrendsListProps) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("ACTIVE");
  const [creating, setCreating] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestErr, setSuggestErr] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const groups: Record<TabKey, Trend[]> = {
    ACTIVE: active,
    WARMING: warming,
    EXPIRED: expired,
  };
  const current = groups[tab];

  async function suggest() {
    setSuggesting(true);
    setSuggestErr(null);
    const res = await fetch("/api/trends/suggest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ count: 5 }),
    });
    setSuggesting(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setSuggestErr(j.error ?? `Errore ${res.status}`);
      return;
    }
    setTab("WARMING");
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-brand-200 bg-brand-50 p-5 dark:border-brand-700 dark:bg-brand-700/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-white p-2 shadow-sm dark:bg-neutral-900">
              <Sparkles className="h-5 w-5 text-brand-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Suggerisci 5 trend con Claude</h2>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                Claude propone trend italiani caldi tarati sul tuo kind. Vengono
                salvati come "Emergenti" — promuovili tu ad attivi se ti convincono.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={suggest}
            disabled={suggesting || busy}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {suggesting ? "Genero…" : "Suggerisci 5 trend"}
          </button>
        </div>
        {suggestErr ? (
          <p className="mt-3 text-xs text-rose-700 dark:text-rose-300">{suggestErr}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" className="flex gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
          {(["ACTIVE", "WARMING", "EXPIRED"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                tab === k
                  ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-900 dark:text-neutral-100"
                  : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100"
              }`}
            >
              {TAB_LABEL[k]} ({groups[k].length})
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
        >
          {creating ? "Annulla" : "+ Aggiungi manualmente"}
        </button>
      </div>

      {creating ? (
        <NewTrendForm
          onCancel={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            setTab("ACTIVE");
            startTransition(() => router.refresh());
          }}
        />
      ) : null}

      {current.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center dark:border-neutral-700 dark:bg-neutral-900">
          <p className="text-sm text-neutral-500">
            Nessun trend in questa categoria.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {current.map((trend) => (
            <TrendCard key={trend.id} trend={trend} />
          ))}
        </ul>
      )}
    </div>
  );
}

function NewTrendForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [kind, setKind] = useState("SOUND");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["INSTAGRAM", "TIKTOK"]);
  const [expiresInDays, setExpiresInDays] = useState("21");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function togglePlatform(p: string) {
    setPlatforms((curr) =>
      curr.includes(p) ? curr.filter((x) => x !== p) : [...curr, p],
    );
  }

  async function submit() {
    setErr(null);
    if (!name.trim()) {
      setErr("Il nome è obbligatorio");
      return;
    }
    if (platforms.length === 0) {
      setErr("Seleziona almeno una piattaforma");
      return;
    }
    setSubmitting(true);
    const days = Number(expiresInDays);
    const expiresAt =
      Number.isFinite(days) && days > 0
        ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
        : undefined;
    const res = await fetch("/api/trends", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind,
        name: name.trim(),
        description: description.trim() || undefined,
        sourceUrl: sourceUrl.trim() || undefined,
        platforms,
        expiresAt,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(j.error ?? `Errore ${res.status}`);
      return;
    }
    onCreated();
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="text-base font-semibold">Nuovo trend manuale</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Tipo">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          >
            <option value="SOUND">Sound</option>
            <option value="FORMAT">Format</option>
            <option value="TOPIC">Topic</option>
            <option value="HASHTAG">Hashtag</option>
            <option value="CHALLENGE">Challenge</option>
          </select>
        </Field>
        <Field label="Nome">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="es. Sound 'Espresso macchiato'"
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          />
        </Field>
        <Field label="Descrizione" full>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          />
        </Field>
        <Field label="Fonte URL (opzionale)" full>
          <input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          />
        </Field>
        <Field label="Scade fra (giorni)">
          <input
            type="number"
            min={1}
            max={90}
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(e.target.value)}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          />
        </Field>
        <Field label="Piattaforme" full>
          <div className="flex flex-wrap gap-2">
            {["INSTAGRAM", "TIKTOK", "YOUTUBE", "FACEBOOK", "SPOTIFY"].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => togglePlatform(p)}
                className={`rounded-md border px-3 py-1.5 text-xs ${
                  platforms.includes(p)
                    ? "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-700/20 dark:text-brand-100"
                    : "border-neutral-300 bg-white text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
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
