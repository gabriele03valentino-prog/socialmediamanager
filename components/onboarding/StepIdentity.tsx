"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CreatorKind } from "@prisma/client";
import { KIND_DISPLAY, getKindLabels } from "@/lib/kind-labels";

const STORAGE_KEY = "m17_wizard_kind";

export function StepIdentity() {
  const router = useRouter();
  const [kind, setKind] = useState<CreatorKind | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [niche, setNiche] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY) as CreatorKind | null;
    if (!stored || !Object.values(CreatorKind).includes(stored)) {
      router.replace("/onboarding?step=1");
      return;
    }
    setKind(stored);
  }, [router]);

  if (!kind) return null;

  const labels = getKindLabels(kind);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!kind) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind,
        displayName: displayName.trim(),
        niche: niche.trim() || null,
        city: city.trim() || null,
        bio: bio.trim() || null,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(
        j.error === "max_projects_reached"
          ? `Limite di ${j.limit} progetti raggiunto.`
          : j.error || "Errore creazione progetto",
      );
      setSubmitting(false);
      return;
    }
    const { project } = await res.json();
    await fetch(`/api/projects/${project.id}/activate`, { method: "POST" });
    sessionStorage.removeItem(STORAGE_KEY);
    router.push("/onboarding?step=3");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="rounded bg-violet-50 p-3 text-sm text-violet-800">
        Stai creando un progetto <strong>{KIND_DISPLAY[kind]}</strong>.{" "}
        <a href="/onboarding?step=1" className="underline">
          Cambia tipo
        </a>
      </p>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          Nome del {labels.creator} <span className="text-red-600">*</span>
        </span>
        <input
          type="text"
          required
          maxLength={80}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full rounded border border-gray-300 p-2"
          placeholder={
            kind === "ARTIST"
              ? "es. Marco Beat"
              : kind === "PODCASTER"
                ? "es. TechCast Italia"
                : "es. Il mio canale"
          }
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Nicchia / genere (opzionale)</span>
        <input
          type="text"
          maxLength={80}
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          className="w-full rounded border border-gray-300 p-2"
          placeholder={
            kind === "ARTIST"
              ? "trap, drill, cantautorato"
              : kind === "DIVULGATORE"
                ? "scienza, storia, tech"
                : "es. lifestyle"
          }
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Città (opzionale)</span>
          <input
            type="text"
            maxLength={80}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full rounded border border-gray-300 p-2"
            placeholder="Milano"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Bio breve (opzionale)</span>
        <textarea
          rows={3}
          maxLength={2000}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="w-full rounded border border-gray-300 p-2"
          placeholder="Una frase che ti descrive — Claude la userà per personalizzare i suggerimenti."
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-between border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={() => router.push("/onboarding?step=1")}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          Indietro
        </button>
        <button
          type="submit"
          disabled={submitting || !displayName.trim()}
          className="rounded bg-violet-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Creo…" : "Avanti"}
        </button>
      </div>
    </form>
  );
}
