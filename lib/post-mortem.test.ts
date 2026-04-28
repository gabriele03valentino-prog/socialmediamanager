import { describe, it, expect } from "vitest";
import { evaluatePostMortem, extractInsightTags, primaryMetric } from "./post-mortem";

describe("primaryMetric", () => {
  it("INSTAGRAM uses engagement", () => {
    const post = { likes: 10, comments: 5, shares: 2, saves: 3, views: null, reach: null };
    expect(primaryMetric("INSTAGRAM", post)).toEqual({ name: "engagement", value: 10 + 10 + 6 + 6 });
  });
  it("TIKTOK uses views", () => {
    const post = { likes: 0, comments: 0, shares: 0, saves: 0, views: 1500, reach: null };
    expect(primaryMetric("TIKTOK", post)).toEqual({ name: "views", value: 1500 });
  });
  it("SPOTIFY returns null (skip)", () => {
    const post = { likes: 0, comments: 0, shares: 0, saves: 0, views: null, reach: null };
    expect(primaryMetric("SPOTIFY", post)).toBeNull();
  });
});

describe("evaluatePostMortem", () => {
  it("OUTLIER_HIGH if ratio >= 2.0", () => {
    expect(evaluatePostMortem(2000, 1000).outcome).toBe("OUTLIER_HIGH");
  });
  it("ABOVE if 1.2 <= ratio < 2.0", () => {
    expect(evaluatePostMortem(1500, 1000).outcome).toBe("ABOVE");
  });
  it("NORMAL if 0.8 <= ratio < 1.2", () => {
    expect(evaluatePostMortem(1000, 1000).outcome).toBe("NORMAL");
    expect(evaluatePostMortem(900, 1000).outcome).toBe("NORMAL");
  });
  it("BELOW if 0.5 <= ratio < 0.8", () => {
    expect(evaluatePostMortem(700, 1000).outcome).toBe("BELOW");
  });
  it("OUTLIER_LOW if ratio < 0.5", () => {
    expect(evaluatePostMortem(400, 1000).outcome).toBe("OUTLIER_LOW");
  });
  it("OUTLIER_HIGH se baseline=0 e postValue>0", () => {
    expect(evaluatePostMortem(100, 0).outcome).toBe("OUTLIER_HIGH");
  });
});

describe("extractInsightTags", () => {
  it("trova tag dalla caption", () => {
    expect(extractInsightTags("Snippet del nuovo singolo, drop venerdì in studio")).toEqual(
      expect.arrayContaining(["snippet", "drop", "studio"]),
    );
  });
  it("ritorna [] se nessun keyword match", () => {
    expect(extractInsightTags("Buongiorno mondo")).toEqual([]);
  });
  it("gestisce caption null/undefined", () => {
    expect(extractInsightTags(null)).toEqual([]);
    expect(extractInsightTags(undefined)).toEqual([]);
  });
});
