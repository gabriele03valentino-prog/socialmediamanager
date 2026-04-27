import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-27T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to max within window", () => {
    const opts = { max: 3, windowMs: 60_000 };
    expect(checkRateLimit("k1", opts).ok).toBe(true);
    expect(checkRateLimit("k1", opts).ok).toBe(true);
    expect(checkRateLimit("k1", opts).ok).toBe(true);
    const blocked = checkRateLimit("k1", opts);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(0);
  });

  it("isolates buckets per key", () => {
    const opts = { max: 1, windowMs: 60_000 };
    expect(checkRateLimit("ka", opts).ok).toBe(true);
    expect(checkRateLimit("kb", opts).ok).toBe(true);
    expect(checkRateLimit("ka", opts).ok).toBe(false);
    expect(checkRateLimit("kb", opts).ok).toBe(false);
  });

  it("releases slots after the window passes", () => {
    const opts = { max: 1, windowMs: 60_000 };
    expect(checkRateLimit("k2", opts).ok).toBe(true);
    expect(checkRateLimit("k2", opts).ok).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect(checkRateLimit("k2", opts).ok).toBe(true);
  });

  it("retryAfterSeconds shrinks while time passes inside window", () => {
    const opts = { max: 1, windowMs: 60_000 };
    checkRateLimit("k3", opts);
    const a = checkRateLimit("k3", opts);
    vi.advanceTimersByTime(30_000);
    const b = checkRateLimit("k3", opts);
    expect(a.retryAfterSeconds).toBeGreaterThan(b.retryAfterSeconds);
  });

  it("decrements remaining count correctly", () => {
    const opts = { max: 5, windowMs: 60_000 };
    expect(checkRateLimit("k4", opts).remaining).toBe(4);
    expect(checkRateLimit("k4", opts).remaining).toBe(3);
    expect(checkRateLimit("k4", opts).remaining).toBe(2);
  });
});
