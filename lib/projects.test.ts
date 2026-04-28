import { describe, it, expect, vi, beforeEach } from "vitest";
import { canCreateProject, MAX_PROJECTS_PER_USER, isAllowlisted } from "./projects";

vi.mock("@/lib/db", () => ({
  prisma: {
    project: { count: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";

describe("projects helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.EMAIL_ALLOWLIST;
  });

  it("MAX_PROJECTS_PER_USER è 5", () => {
    expect(MAX_PROJECTS_PER_USER).toBe(5);
  });

  it("isAllowlisted false se EMAIL_ALLOWLIST non set", () => {
    expect(isAllowlisted("foo@bar.com")).toBe(false);
  });

  it("isAllowlisted normalizza email (lowercase + trim)", () => {
    process.env.EMAIL_ALLOWLIST = "FOO@bar.COM, baz@qux.io";
    expect(isAllowlisted("  foo@BAR.com ")).toBe(true);
    expect(isAllowlisted("baz@qux.io")).toBe(true);
    expect(isAllowlisted("nope@nope.io")).toBe(false);
  });

  it("canCreateProject false a 5 progetti, no allowlist", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ email: "user@test.io" });
    (prisma.project.count as any).mockResolvedValue(5);
    expect(await canCreateProject("u1")).toBe(false);
  });

  it("canCreateProject true a 4 progetti", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ email: "user@test.io" });
    (prisma.project.count as any).mockResolvedValue(4);
    expect(await canCreateProject("u1")).toBe(true);
  });

  it("canCreateProject true a 99 progetti se allowlisted", async () => {
    process.env.EMAIL_ALLOWLIST = "owner@test.io";
    (prisma.user.findUnique as any).mockResolvedValue({ email: "owner@test.io" });
    (prisma.project.count as any).mockResolvedValue(99);
    expect(await canCreateProject("u1")).toBe(true);
  });

  it("canCreateProject false se user non trovato", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    expect(await canCreateProject("ghost")).toBe(false);
  });
});
