import {
  BarChart3,
  Calendar,
  FileText,
  LayoutDashboard,
  Lightbulb,
  Palette,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendario", label: "Calendario", icon: Calendar },
  { href: "/suggerimenti", label: "Suggerimenti", icon: Lightbulb },
  { href: "/bozze", label: "Bozze", icon: FileText },
  { href: "/brand", label: "Brand", icon: Palette },
  { href: "/analytics/instagram", label: "Analytics", icon: BarChart3 },
  { href: "/impostazioni", label: "Impostazioni", icon: Settings },
] as const;

export function SidebarNav({
  current,
  children,
}: {
  current?: string;
  children?: React.ReactNode;
}) {
  return (
    <nav className="flex h-full w-60 flex-col border-r border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <Link href="/" className="mb-8 flex items-center gap-2 px-2">
        <div className="h-8 w-8 rounded-lg bg-brand-600" />
        <span className="font-semibold">SMM Studio</span>
      </Link>
      <ul className="space-y-1">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = current === item.href;
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
  );
}
