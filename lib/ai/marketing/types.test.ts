import { describe, expect, it } from "vitest";
import {
  NeuroBreakdownSchema,
  NeuroImprovementsSchema,
  parseNeuroBreakdown,
  parseNeuroImprovements,
} from "./types";

const VALID = {
  hookStrength: 12,
  emotionalValence: 14,
  noveltyBias: 10,
  rewardPrediction: 9,
  socialSalience: 11,
  curiosityGap: 13,
};

describe("NeuroBreakdownSchema", () => {
  it("accepts valid breakdowns", () => {
    expect(NeuroBreakdownSchema.parse(VALID)).toEqual(VALID);
  });

  it("rejects values out of [0,20]", () => {
    expect(NeuroBreakdownSchema.safeParse({ ...VALID, hookStrength: 21 }).success).toBe(
      false,
    );
    expect(NeuroBreakdownSchema.safeParse({ ...VALID, hookStrength: -1 }).success).toBe(
      false,
    );
  });

  it("rejects missing dimensions", () => {
    const partial = { ...VALID } as Record<string, number>;
    delete partial.hookStrength;
    expect(NeuroBreakdownSchema.safeParse(partial).success).toBe(false);
  });
});

describe("parseNeuroBreakdown", () => {
  it("returns parsed object on valid input", () => {
    expect(parseNeuroBreakdown(VALID)).toEqual(VALID);
  });

  it("returns zero-breakdown on invalid/missing input (no throw)", () => {
    const result = parseNeuroBreakdown(null);
    expect(result.hookStrength).toBe(0);
    expect(result.curiosityGap).toBe(0);
  });

  it("returns zero-breakdown for empty object", () => {
    expect(parseNeuroBreakdown({}).hookStrength).toBe(0);
  });
});

describe("parseNeuroImprovements", () => {
  it("filters non-strings", () => {
    expect(parseNeuroImprovements(["a", 1, null, "b"])).toEqual(["a", "b"]);
  });

  it("returns [] for non-array", () => {
    expect(parseNeuroImprovements("not array")).toEqual([]);
    expect(parseNeuroImprovements(null)).toEqual([]);
  });

  it("filters empty strings", () => {
    expect(parseNeuroImprovements(["a", "", "b"])).toEqual(["a", "b"]);
  });
});

describe("NeuroImprovementsSchema (strict)", () => {
  it("requires 1-6 strings", () => {
    expect(NeuroImprovementsSchema.safeParse([]).success).toBe(false);
    expect(NeuroImprovementsSchema.safeParse(["a", "b", "c"]).success).toBe(true);
    expect(NeuroImprovementsSchema.safeParse(new Array(7).fill("x")).success).toBe(
      false,
    );
  });
});
