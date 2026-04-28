import type { PostOutcome } from "@prisma/client";

const OUTCOME_STYLE: Record<PostOutcome, string> = {
  OUTLIER_HIGH:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-700/30 dark:text-emerald-100",
  ABOVE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-700/20 dark:text-emerald-100",
  NORMAL: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200",
  BELOW: "bg-amber-50 text-amber-700 dark:bg-amber-700/20 dark:text-amber-100",
  OUTLIER_LOW: "bg-rose-100 text-rose-800 dark:bg-rose-700/30 dark:text-rose-100",
};

const OUTCOME_LABEL: Record<PostOutcome, string> = {
  OUTLIER_HIGH: "Top performer",
  ABOVE: "Sopra media",
  NORMAL: "In media",
  BELOW: "Sotto media",
  OUTLIER_LOW: "Flop",
};

interface OutcomeBadgeProps {
  outcome: PostOutcome;
}

export function OutcomeBadge({ outcome }: OutcomeBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${OUTCOME_STYLE[outcome]}`}
    >
      {OUTCOME_LABEL[outcome]}
    </span>
  );
}

export { OUTCOME_LABEL, OUTCOME_STYLE };
