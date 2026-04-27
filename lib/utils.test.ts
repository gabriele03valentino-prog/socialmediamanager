import { describe, expect, it } from "vitest";
import { cn, PLATFORM_LABEL, toDatetimeLocal } from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("dedupes Tailwind utility conflicts via twMerge", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("ignores falsy values", () => {
    expect(cn("a", false, null, undefined, "")).toBe("a");
  });
});

describe("PLATFORM_LABEL", () => {
  it("has the 5 supported platforms", () => {
    for (const k of ["INSTAGRAM", "FACEBOOK", "TIKTOK", "YOUTUBE", "SPOTIFY"]) {
      expect(PLATFORM_LABEL[k]).toBeDefined();
    }
  });
});

describe("toDatetimeLocal", () => {
  it("returns empty string for null/undefined", () => {
    expect(toDatetimeLocal(null)).toBe("");
    expect(toDatetimeLocal(undefined)).toBe("");
  });

  it("returns YYYY-MM-DDTHH:mm format", () => {
    const d = new Date("2026-04-27T15:30:00Z");
    const out = toDatetimeLocal(d);
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(out).toHaveLength(16);
  });

  it("preserves the local minute precision (no seconds)", () => {
    const d = new Date("2026-01-01T08:45:33Z");
    const out = toDatetimeLocal(d);
    expect(out.endsWith(":33")).toBe(false);
  });
});
