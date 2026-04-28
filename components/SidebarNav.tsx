"use client";

import {
  BarChart3,
  Brain,
  Calendar,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Lightbulb,
  Menu,
  Palette,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Project } from "@prisma/client";
import { cn } from "@/lib/utils";
import { ProjectSwitcher } from "./ProjectSwitcher";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendario", label: "Calendario", icon: Calendar },
  { href: "/suggerimenti", label: "Suggerimenti", icon: Lightbulb },
  { href: "/bozze", label: "Bozze", icon: FileText },
  { href: "/obiettivi", label: "Obiettivi", icon: Target },
  { href: "/trend", label: "Trend", icon: TrendingUp },
  { href: "/learnings", label: "Learnings", icon: Sparkles },
  { href: "/progetti", label: "Progetti", icon: FolderKanban },
  { href: "/brand", label: "Brand", icon: Palette },
  { href: "/marketing", label: "Marketing", icon: Brain },
  { href: "/analytics/instagram", label: "Analytics", icon: BarChart3 },
  { href: "/impostazioni", label: "Impostazioni", icon: Settings },
] as const;

interface SidebarNavProps {
  activeProject: Project;
  projects: Pick<Project, "id" | "displayName" | "kind">[];
  children?: React.ReactNode;
}

export function SidebarNav({ activeProject, projects, children }: SidebarNavProps) {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);

  // Chiudi il drawer al cambio rotta (utile dopo che l'utente clicca un link mobile)
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Disabilita scroll del body quando il drawer è aperto su mobile
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Apri menu"
        className="fixed left-3 top-3 z-50 inline-flex items-center justify-center rounded-md border border-neutral-200 bg-white p-2 shadow-sm md:hidden dark:border-neutral-800 dark:bg-neutral-900"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open ? (
        <button
          type="button"
          aria-label="Chiudi menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      ) : null}

      <nav
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 transform flex-col border-r border-neutral-200 bg-white p-4 transition-transform duration-200 md:relative md:translate-x-0 dark:border-neutral-800 dark:bg-neutral-900",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-4 flex items-center justify-between md:mb-6">
          <Link href="/" className="flex items-center gap-2 px-2">
            <div className="h-8 w-8 rounded-lg bg-brand-600" />
            <span className="font-semibold">SMM Studio</span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Chiudi menu"
            className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 md:hidden dark:hover:bg-neutral-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mb-4">
          <ProjectSwitcher active={activeProject} projects={projects} />
        </div>
        <ul className="space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-brand-50 text-brand-700 dark:bg-brand-700/20 dark:text-brand-100"
                      : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
        {children}
      </nav>
    </>
  );
}
