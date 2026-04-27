import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: { project: { findUniqueOrThrow: vi.fn() } },
}));

import { buildContext } from "./context-builder";
import { prisma } from "@/lib/db";

describe("buildContext", () => {
  beforeEach(() => vi.clearAllMocks());

  it("include project block con kind + displayName + niche", async () => {
    (prisma.project.findUniqueOrThrow as any).mockResolvedValue({
      kind: "PODCASTER",
      displayName: "TestCast",
      niche: "tech",
      city: "Milano",
      bio: null,
      user: { timezone: "Europe/Rome" },
      socialAccounts: [],
    });
    const ctx = await buildContext("p1");
    expect(ctx.project.kind).toBe("PODCASTER");
    expect(ctx.project.displayName).toBe("TestCast");
    expect(ctx.project.niche).toBe("tech");
    expect(ctx.project.city).toBe("Milano");
    expect(ctx.timezone).toBe("Europe/Rome");
  });

  it("ritorna accounts vuoto se nessun socialAccount", async () => {
    (prisma.project.findUniqueOrThrow as any).mockResolvedValue({
      kind: "ARTIST",
      displayName: "X",
      niche: null,
      city: null,
      bio: null,
      user: { timezone: "Europe/Rome" },
      socialAccounts: [],
    });
    const ctx = await buildContext("p1");
    expect(ctx.accounts).toEqual([]);
  });

  it("today è YYYY-MM-DD", async () => {
    (prisma.project.findUniqueOrThrow as any).mockResolvedValue({
      kind: "ARTIST",
      displayName: "X",
      niche: null,
      city: null,
      bio: null,
      user: { timezone: "Europe/Rome" },
      socialAccounts: [],
    });
    const ctx = await buildContext("p1");
    expect(ctx.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
