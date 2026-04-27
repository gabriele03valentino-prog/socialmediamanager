import type { CreatorKind } from "@prisma/client";
import { KIND_DISPLAY } from "@/lib/kind-labels";
import { clsx } from "clsx";

const COLORS: Record<CreatorKind, string> = {
  ARTIST:      "bg-violet-100 text-violet-700",
  YOUTUBER:    "bg-red-100 text-red-700",
  INFLUENCER:  "bg-pink-100 text-pink-700",
  DIVULGATORE: "bg-blue-100 text-blue-700",
  PODCASTER:   "bg-amber-100 text-amber-700",
  BRAND:       "bg-emerald-100 text-emerald-700",
};

interface Props {
  kind: CreatorKind;
  className?: string;
}

export function ProjectKindBadge({ kind, className }: Props) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
        COLORS[kind],
        className,
      )}
    >
      {KIND_DISPLAY[kind]}
    </span>
  );
}
