import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, LIMITS, rateLimitOrResponse } from "./rate-limit";

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

describe("rateLimitOrResponse", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-27T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("usa chiave composita projectId quando passato (quota indipendente per progetto)", () => {
    // userId unico per evitare collisioni con altri test che condividono la
    // Map globale `buckets`.
    const userId = "u_t20_composite";

    // Saturiamo la quota per (userId, p1, suggestionsGenerate): max=3 → 3 OK.
    for (let i = 0; i < LIMITS.suggestionsGenerate.max; i++) {
      const r = rateLimitOrResponse(
        userId,
        "suggestionsGenerate",
        LIMITS.suggestionsGenerate,
        "p1",
      );
      expect(r).toBeNull();
    }

    // 4ª chiamata su p1 → 429 (quota route saturata per p1).
    const blockedP1 = rateLimitOrResponse(
      userId,
      "suggestionsGenerate",
      LIMITS.suggestionsGenerate,
      "p1",
    );
    expect(blockedP1?.status).toBe(429);

    // 1ª chiamata su p2 → OK (quota indipendente).
    const okP2 = rateLimitOrResponse(
      userId,
      "suggestionsGenerate",
      LIMITS.suggestionsGenerate,
      "p2",
    );
    expect(okP2).toBeNull();
  });

  it("global cap blocca cross-progetto (50 chiamate distribuite saturano)", () => {
    const userId = "u_t20_global";

    // marketingScore.max = 30 > 1, quindi possiamo distribuire 50 chiamate
    // su 50 progetti distinti senza saturare la quota per-route, e arrivare
    // a saturare il cap globale (50/h).
    for (let i = 0; i < LIMITS.global.max; i++) {
      const r = rateLimitOrResponse(
        userId,
        "marketingScore",
        LIMITS.marketingScore,
        `p${i}`,
      );
      expect(r).toBeNull();
    }

    // 51ª chiamata su un progetto nuovo → 429 dal cap globale.
    const blocked = rateLimitOrResponse(
      userId,
      "marketingScore",
      LIMITS.marketingScore,
      "p_new",
    );
    expect(blocked?.status).toBe(429);
  });

  it("backward compat: senza projectId usa chiave legacy userId:routeKey", () => {
    const userId = "u_t20_legacy";

    // Saturiamo la quota legacy.
    for (let i = 0; i < LIMITS.brandIdentity.max; i++) {
      const r = rateLimitOrResponse(
        userId,
        "brandIdentity",
        LIMITS.brandIdentity,
      );
      expect(r).toBeNull();
    }
    const blocked = rateLimitOrResponse(
      userId,
      "brandIdentity",
      LIMITS.brandIdentity,
    );
    expect(blocked?.status).toBe(429);
  });
});
