"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Check } from "lucide-react";
import type { Project } from "@prisma/client";
import { ProjectKindBadge } from "./ProjectKindBadge";
import { CreateProjectModal } from "./CreateProjectModal";

interface Props {
  active: Project;
  projects: Pick<Project, "id" | "displayName" | "kind">[];
}

export function ProjectSwitcher({ active, projects }: Props) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  async function activate(id: string) {
    if (id === active.id) {
      setOpen(false);
      return;
    }
    await fetch(`/api/projects/${id}/activate`, { method: "POST" });
    router.refresh();
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-left hover:bg-gray-50"
      >
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{active.displayName}</div>
          <ProjectKindBadge kind={active.kind} className="mt-0.5" />
        </div>
        <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-500" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded border border-gray-200 bg-white shadow-lg">
          <ul className="max-h-64 overflow-auto py-1">
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => activate(p.id)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm">{p.displayName}</div>
                    <ProjectKindBadge kind={p.kind} className="mt-0.5" />
                  </div>
                  {p.id === active.id && <Check className="h-4 w-4 text-violet-600" />}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setCreating(true);
            }}
            className="flex w-full items-center gap-2 border-t border-gray-100 px-3 py-2 text-sm text-violet-700 hover:bg-violet-50"
          >
            <Plus className="h-4 w-4" />
            Nuovo progetto
          </button>
        </div>
      )}

      {creating && <CreateProjectModal onClose={() => setCreating(false)} />}
    </div>
  );
}
