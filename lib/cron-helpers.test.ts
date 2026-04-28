import { describe, it, expect } from "vitest";
import { groupFeedbackByUser } from "./cron-helpers";

describe("groupFeedbackByUser", () => {
  it("aggrega feedback di N progetti in 1 entry per utente", () => {
    const items = [
      { userId: "u1", project: { id: "p1", displayName: "A", kind: "ARTIST" }, feedback: { headline: "ha", body: "ba", postsCount: 1 } },
      { userId: "u1", project: { id: "p2", displayName: "B", kind: "PODCASTER" }, feedback: { headline: "hb", body: "bb", postsCount: 0 } },
      { userId: "u2", project: { id: "p3", displayName: "C", kind: "BRAND" }, feedback: { headline: "hc", body: "bc", postsCount: 2 } },
    ];
    const grouped = groupFeedbackByUser(items);
    expect(grouped).toHaveLength(2);
    const u1 = grouped.find((g) => g.userId === "u1");
    expect(u1).toBeDefined();
    expect(u1!.projects).toHaveLength(2);
    expect(u1!.projects[0]?.displayName).toBe("A");
  });

  it("ritorna [] su input vuoto", () => {
    expect(groupFeedbackByUser([])).toEqual([]);
  });

  it("preserva ordine inserimento progetti per utente", () => {
    const items = [
      { userId: "u1", project: { id: "p2", displayName: "B", kind: "ARTIST" }, feedback: { headline: "h", body: "b", postsCount: 0 } },
      { userId: "u1", project: { id: "p1", displayName: "A", kind: "ARTIST" }, feedback: { headline: "h", body: "b", postsCount: 0 } },
    ];
    const grouped = groupFeedbackByUser(items);
    expect(grouped[0]?.projects.map((p) => p.displayName)).toEqual(["B", "A"]);
  });
});
