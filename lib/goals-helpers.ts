// Pure helpers per il modulo Goal — separati per testabilità.

export const DAY_MS = 24 * 60 * 60 * 1000;

export function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function toMs(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00Z`).getTime();
}

export function clampPercent(p: number): number {
  if (Number.isNaN(p) || !Number.isFinite(p)) return 0;
  return Math.max(0, Math.min(200, Math.round(p)));
}

export function dedupeByDay(
  rows: Array<{ date: string; value: number }>,
): Array<{ date: string; value: number }> {
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.date, r.value); // ultimo vince
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, value]) => ({ date, value }));
}

export interface ProjectionInput {
  series: Array<{ date: string; value: number }>;
  targetMs: number | null;
  target: number;
  current: number;
  /** time function injected for tests */
  now?: () => number;
}

export function projectLinear({
  series,
  targetMs,
  target,
  current,
  now = Date.now,
}: ProjectionInput): { projection: number | null; onTrack: boolean | null } {
  if (targetMs === null || series.length < 3) {
    return { projection: null, onTrack: null };
  }
  const window = series.slice(-14);
  const first = window[0]!;
  const last = window[window.length - 1]!;
  const days = (toMs(last.date) - toMs(first.date)) / DAY_MS;
  if (days <= 0) return { projection: null, onTrack: null };
  const dailyDelta = (last.value - first.value) / days;
  const daysToTarget = (targetMs - now()) / DAY_MS;
  if (daysToTarget <= 0) return { projection: current, onTrack: current >= target };
  const projection = Math.round(current + dailyDelta * daysToTarget);
  return { projection, onTrack: projection >= target };
}
