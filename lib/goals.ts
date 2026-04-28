import type { Goal, GoalMetric, Platform, Prisma } from "@prisma/client";
import { prisma } from "./db";
import {
  clampPercent,
  DAY_MS,
  dedupeByDay,
  projectLinear,
  toDateKey,
} from "./goals-helpers";

export interface GoalProgress {
  goalId: string;
  current: number;
  start: number;
  target: number;
  percent: number; // 0..100, può superare 100 se sopra target
  remaining: number;
  daysLeft: number | null;
  daysElapsed: number;
  series: Array<{ date: string; value: number }>;
  /**
   * Stima lineare del valore alla targetDate basata sul delta medio giornaliero
   * dei dati storici. null se non ci sono abbastanza dati o targetDate è assente.
   */
  projection: number | null;
  /**
   * true se la projection raggiunge il target entro la deadline.
   */
  onTrack: boolean | null;
}

/**
 * Carica la serie storica del goal (uno snapshot per giorno) e calcola la
 * progressione. Per FOLLOWERS legge MetricSnapshot.followers; per AVG_VIEWS e
 * AVG_REACH calcola media sui Post per ciascun giorno; MONTHLY_LISTENERS è un
 * campo manuale conservato in Goal.note (formato "current=NNN") finché Spotify
 * non espone l'API.
 */
export async function getGoalProgress(goal: Goal): Promise<GoalProgress> {
  const account = await prisma.socialAccount.findFirst({
    where: { projectId: goal.projectId, platform: goal.platform },
    orderBy: { createdAt: "asc" },
  });

  const series = account
    ? await loadSeries(account.id, goal.metric, goal.startedAt)
    : [];

  const current = series.length > 0 ? series[series.length - 1]!.value : goal.startValue;
  const start = goal.startValue;
  const target = goal.targetValue;
  const range = Math.max(target - start, 1);
  const percent = clampPercent(((current - start) / range) * 100);
  const remaining = Math.max(target - current, 0);

  const now = Date.now();
  const startedMs = goal.startedAt.getTime();
  const targetMs = goal.targetDate?.getTime() ?? null;
  const daysElapsed = Math.max(0, Math.floor((now - startedMs) / DAY_MS));
  const daysLeft = targetMs !== null ? Math.max(0, Math.ceil((targetMs - now) / DAY_MS)) : null;

  const { projection, onTrack } = projectLinear({
    series,
    targetMs,
    target,
    current,
  });

  return {
    goalId: goal.id,
    current,
    start,
    target,
    percent,
    remaining,
    daysLeft,
    daysElapsed,
    series,
    projection,
    onTrack,
  };
}

async function loadSeries(
  accountId: string,
  metric: GoalMetric,
  since: Date,
): Promise<Array<{ date: string; value: number }>> {
  if (metric === "FOLLOWERS") {
    const snapshots = await prisma.metricSnapshot.findMany({
      where: { accountId, capturedAt: { gte: since }, followers: { not: null } },
      orderBy: { capturedAt: "asc" },
      select: { capturedAt: true, followers: true },
    });
    return dedupeByDay(
      snapshots.map((s) => ({
        date: toDateKey(s.capturedAt),
        value: s.followers ?? 0,
      })),
    );
  }

  if (metric === "AVG_REACH") {
    const snapshots = await prisma.metricSnapshot.findMany({
      where: { accountId, capturedAt: { gte: since }, reach: { not: null } },
      orderBy: { capturedAt: "asc" },
      select: { capturedAt: true, reach: true },
    });
    return dedupeByDay(
      snapshots.map((s) => ({ date: toDateKey(s.capturedAt), value: s.reach ?? 0 })),
    );
  }

  if (metric === "AVG_VIEWS") {
    const posts = await prisma.post.findMany({
      where: { accountId, postedAt: { gte: since }, views: { not: null } },
      orderBy: { postedAt: "asc" },
      select: { postedAt: true, views: true },
    });
    if (posts.length === 0) return [];
    // Rolling avg degli ultimi 20 post per giorno
    const byDay = new Map<string, number[]>();
    for (const p of posts) {
      const day = toDateKey(p.postedAt);
      const arr = byDay.get(day) ?? [];
      arr.push(p.views ?? 0);
      byDay.set(day, arr);
    }
    const days = [...byDay.keys()].sort();
    const out: Array<{ date: string; value: number }> = [];
    let window: number[] = [];
    for (const day of days) {
      window = [...window, ...byDay.get(day)!].slice(-20);
      const avg = window.reduce((a, b) => a + b, 0) / window.length;
      out.push({ date: day, value: Math.round(avg) });
    }
    return out;
  }

  // MONTHLY_LISTENERS: campo manuale, niente serie automatica.
  return [];
}

/**
 * Esegue la valutazione di un goal: se il valore corrente ha raggiunto il
 * target → ACHIEVED; se la deadline è passata e non è raggiunto → EXPIRED.
 * Idempotente. Da chiamare nel cron giornaliero.
 */
export async function evaluateGoal(goal: Goal): Promise<{
  changed: boolean;
  status: Goal["status"];
}> {
  if (goal.status !== "ACTIVE") {
    return { changed: false, status: goal.status };
  }
  const progress = await getGoalProgress(goal);
  const reached = progress.current >= goal.targetValue;
  const expired =
    goal.targetDate !== null && goal.targetDate.getTime() < Date.now() && !reached;

  if (reached) {
    await prisma.goal.update({
      where: { id: goal.id },
      data: { status: "ACHIEVED", achievedAt: new Date() },
    });
    return { changed: true, status: "ACHIEVED" };
  }
  if (expired) {
    await prisma.goal.update({
      where: { id: goal.id },
      data: { status: "EXPIRED" },
    });
    return { changed: true, status: "EXPIRED" };
  }
  return { changed: false, status: "ACTIVE" };
}

/**
 * Valuta tutti i goal ACTIVE di un singolo Project. Pensata per il cron T18,
 * che itera sui progetti dell'utente (non più sull'utente direttamente).
 */
export async function evaluateProjectGoals(projectId: string): Promise<{
  evaluated: number;
  changed: number;
  errors: number;
}> {
  const goals = await prisma.goal.findMany({
    where: { projectId, status: "ACTIVE" },
  });
  let changed = 0;
  let errors = 0;
  for (const g of goals) {
    try {
      const r = await evaluateGoal(g);
      if (r.changed) changed += 1;
    } catch {
      // Un goal singolo che fallisce (es. timeout DB transitorio) non deve
      // interrompere la valutazione degli altri.
      errors += 1;
    }
  }
  return { evaluated: goals.length, changed, errors };
}

export const GOAL_METRIC_LABEL: Record<GoalMetric, string> = {
  FOLLOWERS: "Follower",
  AVG_VIEWS: "Views medie",
  AVG_REACH: "Reach medio",
  MONTHLY_LISTENERS: "Ascoltatori mensili",
};

export const GOAL_STATUS_LABEL: Record<Goal["status"], string> = {
  ACTIVE: "Attivo",
  ACHIEVED: "Raggiunto",
  EXPIRED: "Scaduto",
  ARCHIVED: "Archiviato",
};

export type CreateGoalInput = Pick<
  Prisma.GoalCreateManyInput,
  "platform" | "metric" | "targetValue" | "targetDate" | "note"
>;

export async function createGoalForProject(
  projectId: string,
  input: CreateGoalInput,
): Promise<Goal> {
  // Calcoliamo lo startValue dal MetricSnapshot/Post più recente, così la
  // percentuale di completamento è onesta dal giorno 1.
  const startValue = await computeCurrentValue(projectId, input.platform!, input.metric!);
  return prisma.goal.create({
    data: {
      projectId,
      platform: input.platform!,
      metric: input.metric!,
      targetValue: input.targetValue!,
      targetDate: input.targetDate ?? null,
      startValue,
      note: input.note ?? null,
    },
  });
}

async function computeCurrentValue(
  projectId: string,
  platform: Platform,
  metric: GoalMetric,
): Promise<number> {
  const account = await prisma.socialAccount.findFirst({
    where: { projectId, platform },
    orderBy: { createdAt: "asc" },
  });
  if (!account) return 0;

  if (metric === "FOLLOWERS") {
    const last = await prisma.metricSnapshot.findFirst({
      where: { accountId: account.id, followers: { not: null } },
      orderBy: { capturedAt: "desc" },
      select: { followers: true },
    });
    return last?.followers ?? 0;
  }
  if (metric === "AVG_REACH") {
    const last = await prisma.metricSnapshot.findFirst({
      where: { accountId: account.id, reach: { not: null } },
      orderBy: { capturedAt: "desc" },
      select: { reach: true },
    });
    return last?.reach ?? 0;
  }
  if (metric === "AVG_VIEWS") {
    const posts = await prisma.post.findMany({
      where: { accountId: account.id, views: { not: null } },
      orderBy: { postedAt: "desc" },
      take: 20,
      select: { views: true },
    });
    if (posts.length === 0) return 0;
    const sum = posts.reduce((acc, p) => acc + (p.views ?? 0), 0);
    return Math.round(sum / posts.length);
  }
  return 0;
}
