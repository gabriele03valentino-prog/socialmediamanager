import type { TrendKind } from "@prisma/client";

const KIND_STYLE: Record<TrendKind, string> = {
  SOUND: "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-700/20 dark:text-fuchsia-100",
  FORMAT: "bg-indigo-50 text-indigo-700 dark:bg-indigo-700/20 dark:text-indigo-100",
  TOPIC: "bg-amber-50 text-amber-700 dark:bg-amber-700/20 dark:text-amber-100",
  HASHTAG: "bg-sky-50 text-sky-700 dark:bg-sky-700/20 dark:text-sky-100",
  CHALLENGE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-700/20 dark:text-emerald-100",
};

const KIND_LABEL: Record<TrendKind, string> = {
  SOUND: "Sound",
  FORMAT: "Format",
  TOPIC: "Topic",
  HASHTAG: "Hashtag",
  CHALLENGE: "Challenge",
};

interface TrendKindBadgeProps {
  kind: TrendKind;
}

export function TrendKindBadge({ kind }: TrendKindBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${KIND_STYLE[kind]}`}
    >
      {KIND_LABEL[kind]}
    </span>
  );
}
