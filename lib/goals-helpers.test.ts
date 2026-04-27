import { describe, expect, it } from "vitest";
import {
  clampPercent,
  DAY_MS,
  dedupeByDay,
  projectLinear,
  toDateKey,
  toMs,
} from "./goals-helpers";

describe("toDateKey", () => {
  it("returns YYYY-MM-DD UTC", () => {
    expect(toDateKey(new Date("2026-04-27T15:00:00Z"))).toBe("2026-04-27");
  });
});

describe("toMs / DAY_MS", () => {
  it("toMs(date+1) - toMs(date) = DAY_MS", () => {
    expect(toMs("2026-04-28") - toMs("2026-04-27")).toBe(DAY_MS);
  });
});

describe("clampPercent", () => {
  it("rounds and clamps to [0, 200]", () => {
    expect(clampPercent(0)).toBe(0);
    expect(clampPercent(50.4)).toBe(50);
    expect(clampPercent(50.5)).toBe(51);
    expect(clampPercent(250)).toBe(200);
    expect(clampPercent(-10)).toBe(0);
  });

  it("returns 0 for NaN/Infinity", () => {
    expect(clampPercent(Number.NaN)).toBe(0);
    expect(clampPercent(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("dedupeByDay", () => {
  it("keeps last value per date", () => {
    const out = dedupeByDay([
      { date: "2026-04-27", value: 100 },
      { date: "2026-04-27", value: 110 },
      { date: "2026-04-26", value: 90 },
    ]);
    expect(out).toEqual([
      { date: "2026-04-26", value: 90 },
      { date: "2026-04-27", value: 110 },
    ]);
  });

  it("returns [] for empty input", () => {
    expect(dedupeByDay([])).toEqual([]);
  });

  it("sorts ascending by date", () => {
    const out = dedupeByDay([
      { date: "2026-05-01", value: 1 },
      { date: "2026-04-15", value: 2 },
      { date: "2026-04-30", value: 3 },
    ]);
    expect(out.map((r) => r.date)).toEqual([
      "2026-04-15",
      "2026-04-30",
      "2026-05-01",
    ]);
  });
});

describe("projectLinear", () => {
  const now = () => new Date("2026-04-27T00:00:00Z").getTime();

  it("returns null when targetMs is null", () => {
    const r = projectLinear({
      series: [
        { date: "2026-04-20", value: 100 },
        { date: "2026-04-21", value: 110 },
        { date: "2026-04-22", value: 120 },
      ],
      targetMs: null,
      target: 200,
      current: 120,
      now,
    });
    expect(r.projection).toBeNull();
    expect(r.onTrack).toBeNull();
  });

  it("returns null when series too short (< 3 points)", () => {
    const r = projectLinear({
      series: [
        { date: "2026-04-20", value: 100 },
        { date: "2026-04-21", value: 110 },
      ],
      targetMs: toMs("2026-05-27"),
      target: 200,
      current: 110,
      now,
    });
    expect(r.projection).toBeNull();
  });

  it("projects on-track when growth rate would reach target", () => {
    // 10 points growing by +10/day => +30/day expected over a 30-day window
    const series = Array.from({ length: 10 }, (_, i) => ({
      date: toDateKey(new Date(now() - (10 - i) * DAY_MS)),
      value: 100 + i * 10,
    }));
    const r = projectLinear({
      series,
      targetMs: now() + 30 * DAY_MS, // 30 giorni avanti
      target: 400,
      current: series[series.length - 1]!.value,
      now,
    });
    expect(r.projection).toBeGreaterThanOrEqual(400);
    expect(r.onTrack).toBe(true);
  });

  it("flags off-track when growth too slow", () => {
    const series = Array.from({ length: 10 }, (_, i) => ({
      date: toDateKey(new Date(now() - (10 - i) * DAY_MS)),
      value: 100 + i, // +1/day only
    }));
    const r = projectLinear({
      series,
      targetMs: now() + 20 * DAY_MS,
      target: 1000,
      current: series[series.length - 1]!.value,
      now,
    });
    expect(r.onTrack).toBe(false);
  });

  it("returns current when target date already passed", () => {
    const series = [
      { date: "2026-04-20", value: 100 },
      { date: "2026-04-21", value: 110 },
      { date: "2026-04-22", value: 120 },
    ];
    const r = projectLinear({
      series,
      targetMs: now() - DAY_MS, // ieri
      target: 200,
      current: 120,
      now,
    });
    expect(r.projection).toBe(120);
    expect(r.onTrack).toBe(false);
  });
});
