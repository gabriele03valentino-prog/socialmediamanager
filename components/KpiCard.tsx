import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: string;
  delta?: number;
  hint?: string;
}) {
  const sign = delta === undefined ? undefined : delta > 0 ? "+" : "";
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div className="mt-1 flex items-center justify-between text-xs">
        {delta !== undefined ? (
          <span
            className={cn(
              delta === 0
                ? "text-neutral-500"
                : delta > 0
                  ? "text-emerald-600"
                  : "text-rose-600",
            )}
          >
            {sign}
            {delta.toLocaleString("it-IT")} (7g)
          </span>
        ) : (
          <span className="text-neutral-400">—</span>
        )}
        {hint ? <span className="text-neutral-400">{hint}</span> : null}
      </div>
    </div>
  );
}
