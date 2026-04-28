"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreatorKind } from "@prisma/client";
import { KIND_DISPLAY } from "@/lib/kind-labels";

interface Props {
  onClose: () => void;
}

export function CreateProjectModal({ onClose }: Props) {
  const [kind, setKind] = useState<CreatorKind>("ARTIST");
  const [displayName, setDisplayName] = useState("");
  const [niche, setNiche] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind,
        displayName: displayName.trim(),
        niche: niche.trim() || null,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      if (j.error === "max_projects_reached") {
        setError(`Limite di ${j.limit} progetti raggiunto.`);
      } else {
        setError(j.error || "Errore creazione progetto");
      }
      setSubmitting(false);
      return;
    }
    const { project } = await res.json();
    await fetch(`/api/projects/${project.id}/activate`, { method: "POST" });
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">Nuovo progetto</h2>
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Tipo</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as CreatorKind)}
              className="w-full rounded border border-gray-300 p-2"
            >
              {Object.values(CreatorKind).map((k) => (
                <option key={k} value={k}>
                  {KIND_DISPLAY[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Nome progetto</span>
            <input
              type="text"
              required
              maxLength={80}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded border border-gray-300 p-2"
              placeholder="es. Mio progetto musicale"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Nicchia (opzionale)</span>
            <input
              type="text"
              maxLength={80}
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              className="w-full rounded border border-gray-300 p-2"
              placeholder="es. trap, tech reviews, history"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded px-4 py-2 text-sm">
              Annulla
            </button>
            <button
              type="submit"
              disabled={submitting || !displayName.trim()}
              className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {submitting ? "Creo…" : "Crea progetto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
