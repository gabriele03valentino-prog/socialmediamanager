"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Project } from "@prisma/client";

interface Props {
  project: Project;
}

export function ProjectSettingsForm({ project }: Props) {
  const [displayName, setDisplayName] = useState(project.displayName);
  const [niche, setNiche] = useState(project.niche || "");
  const [city, setCity] = useState(project.city || "");
  const [bio, setBio] = useState(project.bio || "");
  const [emailEnabled, setEmailEnabled] = useState(project.emailFeedbackEnabled);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const router = useRouter();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: displayName.trim(),
        niche: niche.trim() || null,
        city: city.trim() || null,
        bio: bio.trim() || null,
        emailFeedbackEnabled: emailEnabled,
      }),
    });
    setSaving(false);
    router.refresh();
  }

  async function destroy() {
    if (confirmText !== "DELETE") return;
    setDeleting(true);
    await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    router.push("/progetti");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Nome</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded border border-gray-300 p-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Nicchia</span>
          <input
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            className="w-full rounded border border-gray-300 p-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Città</span>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full rounded border border-gray-300 p-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Bio</span>
          <textarea
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full rounded border border-gray-300 p-2"
          />
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={emailEnabled}
            onChange={(e) => setEmailEnabled(e.target.checked)}
          />
          <span className="text-sm">Includi questo progetto nell'email feedback giornaliero</span>
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Salvo…" : "Salva"}
        </button>
      </form>

      <div className="rounded border border-red-300 bg-red-50 p-4">
        <h3 className="text-sm font-semibold text-red-800">Zona pericolosa</h3>
        <p className="mt-1 text-sm text-red-700">
          Eliminare il progetto cancella TUTTI i dati associati (account social, suggerimenti, draft, brand,
          campagne, obiettivi). Operazione irreversibile.
        </p>
        <input
          type="text"
          placeholder="Digita DELETE per confermare"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="mt-2 w-full rounded border border-red-300 p-2 text-sm"
        />
        <button
          type="button"
          onClick={destroy}
          disabled={confirmText !== "DELETE" || deleting}
          className="mt-2 rounded bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {deleting ? "Elimino…" : "Elimina progetto"}
        </button>
      </div>
    </div>
  );
}
