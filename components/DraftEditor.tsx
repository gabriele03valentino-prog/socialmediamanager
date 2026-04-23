"use client";

import type { Draft } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PLATFORM_LABEL } from "@/lib/utils";

export function DraftEditor({ draft }: { draft: Draft }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [, startTransition] = useTransition();

  const [caption, setCaption] = useState(draft.caption);
  const [hashtagsText, setHashtagsText] = useState(
    draft.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" "),
  );
  const [status, setStatus] = useState<Draft["status"]>(draft.status);
  const [scheduledFor, setScheduledFor] = useState(
    draft.scheduledFor
      ? new Date(
          draft.scheduledFor.getTime() - draft.scheduledFor.getTimezoneOffset() * 60000,
        )
          .toISOString()
          .slice(0, 16)
      : "",
  );
  const [mediaNotes, setMediaNotes] = useState(draft.mediaNotes ?? "");
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  const fullText = `${caption}\n\n${hashtagsText}`.trim();

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopyMsg("copiato ✓");
      setTimeout(() => setCopyMsg(null), 2000);
    } catch {
      setCopyMsg("copia fallita");
    }
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        caption,
        hashtags: hashtagsText
          .split(/\s+/)
          .map((h) => h.replace(/^#/, "").trim())
          .filter(Boolean),
        status,
        scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
        mediaNotes,
      };
      const res = await fetch(`/api/drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!confirm("Eliminare definitivamente questa bozza?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/drafts/${draft.id}`, { method: "DELETE" });
      if (res.ok) router.push("/bozze");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <span className="rounded bg-brand-50 px-2 py-0.5 text-brand-700 dark:bg-brand-700/20 dark:text-brand-100">
          {PLATFORM_LABEL[draft.platform] ?? draft.platform}
        </span>
        <span>{draft.contentType}</span>
      </div>

      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
          Caption
        </label>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={8}
          className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
        />
      </div>

      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
          Hashtag (separati da spazio)
        </label>
        <input
          value={hashtagsText}
          onChange={(e) => setHashtagsText(e.target.value)}
          className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
            Quando
          </label>
          <input
            type="datetime-local"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          />
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
            Stato
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Draft["status"])}
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
          >
            <option value="TODO">Da fare</option>
            <option value="READY">Pronta</option>
            <option value="PUBLISHED">Pubblicata</option>
            <option value="ARCHIVED">Archiviata</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
          Note di produzione
        </label>
        <textarea
          value={mediaNotes}
          onChange={(e) => setMediaNotes(e.target.value)}
          rows={3}
          placeholder="es. registrare 15s in studio, esportare 9:16, titolare la clip…"
          className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? "Salvo…" : "Salva"}
        </button>
        <button
          onClick={copyAll}
          type="button"
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
        >
          Copia caption + hashtag
        </button>
        {copyMsg ? <span className="text-xs text-neutral-500">{copyMsg}</span> : null}
        <button
          onClick={del}
          disabled={deleting}
          className="ml-auto text-sm text-rose-600 hover:underline disabled:opacity-50"
        >
          {deleting ? "…" : "Elimina"}
        </button>
      </div>
    </div>
  );
}
