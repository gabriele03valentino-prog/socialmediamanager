import { describe, it, expect } from "vitest";
import { CreatorKind } from "@prisma/client";
import { getKindLabels, KIND_LABELS } from "./kind-labels";

describe("kind-labels", () => {
  it("ha labels per ogni CreatorKind", () => {
    for (const kind of Object.values(CreatorKind)) {
      const labels = KIND_LABELS[kind];
      expect(labels).toBeDefined();
      expect(labels.creator.length).toBeGreaterThan(0);
      expect(labels.content.length).toBeGreaterThan(0);
      expect(labels.goal.length).toBeGreaterThan(0);
    }
  });

  it("getKindLabels ritorna labels corretti per ARTIST", () => {
    const labels = getKindLabels("ARTIST");
    expect(labels.creator).toBe("artista");
  });

  it("getKindLabels ritorna labels corretti per PODCASTER", () => {
    const labels = getKindLabels("PODCASTER");
    expect(labels.goal).toBe("ascoltatori");
  });
});
