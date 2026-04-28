"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreatorKind } from "@prisma/client";
import { KindCard } from "@/components/KindCard";

const STORAGE_KEY = "m17_wizard_kind";

export function StepKindPicker() {
  const [selected, setSelected] = useState<CreatorKind | null>(null);
  const router = useRouter();

  function pick(kind: CreatorKind) {
    setSelected(kind);
    sessionStorage.setItem(STORAGE_KEY, kind);
  }

  function next() {
    if (!selected) return;
    router.push("/onboarding?step=2");
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.values(CreatorKind).map((kind) => (
          <KindCard
            key={kind}
            kind={kind}
            selected={selected === kind}
            onClick={() => pick(kind)}
          />
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 pt-4">
        <a href="/progetti?create=1" className="text-xs text-gray-500 hover:text-gray-700">
          Salta wizard (form classico)
        </a>
        <button
          type="button"
          onClick={next}
          disabled={!selected}
          className="rounded bg-violet-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Avanti
        </button>
      </div>
    </div>
  );
}
