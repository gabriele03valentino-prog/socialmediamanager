import { describe, it, expect, beforeEach, vi } from "vitest";
import { signProjectCookie, verifyProjectCookie } from "./active-project";

describe("active-project cookie HMAC", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test_secret_for_unit_tests_only_xxxxx";
  });

  it("signProjectCookie produce stringa formato projectId.hmac", () => {
    const cookie = signProjectCookie("proj_abc");
    expect(cookie).toMatch(/^proj_abc\.[a-f0-9]+$/);
  });

  it("verifyProjectCookie ritorna projectId per cookie valido", () => {
    const cookie = signProjectCookie("proj_abc");
    expect(verifyProjectCookie(cookie)).toBe("proj_abc");
  });

  it("verifyProjectCookie ritorna null se HMAC tampered", () => {
    const cookie = signProjectCookie("proj_abc");
    const tampered = cookie.replace(/.$/, "0");
    expect(verifyProjectCookie(tampered)).toBeNull();
  });

  it("verifyProjectCookie ritorna null se projectId tampered", () => {
    const cookie = signProjectCookie("proj_abc");
    const parts = cookie.split(".");
    const tampered = `proj_xyz.${parts[1]}`;
    expect(verifyProjectCookie(tampered)).toBeNull();
  });

  it("verifyProjectCookie ritorna null se formato invalido", () => {
    expect(verifyProjectCookie("garbage")).toBeNull();
    expect(verifyProjectCookie("")).toBeNull();
    expect(verifyProjectCookie("proj_abc")).toBeNull();
  });
});

import {
  getActiveProject,
  setActiveProjectCookie,
  withProject,
  ACTIVE_PROJECT_COOKIE,
} from "./active-project";

vi.mock("@/lib/db", () => ({
  prisma: { project: { findFirst: vi.fn(), findUnique: vi.fn() } },
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { prisma } from "@/lib/db";
import { auth } from "@/auth";

describe("getActiveProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SECRET = "test_secret_for_unit_tests_only_xxxxx";
  });

  it("ritorna progetto se cookie firmato valido + ownership ok", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1" } });
    (prisma.project.findUnique as any).mockResolvedValue({
      id: "p1",
      userId: "u1",
      kind: "ARTIST",
    });
    const cookie = signProjectCookie("p1");
    const fakeReq = {
      cookies: { get: (n: string) => (n === ACTIVE_PROJECT_COOKIE ? { value: cookie } : undefined) },
    } as any;
    const project = await getActiveProject(fakeReq);
    expect(project?.id).toBe("p1");
  });

  it("rejects cookie cross-user (project.userId !== session.user.id)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1" } });
    (prisma.project.findUnique as any).mockResolvedValue({ id: "p1", userId: "OTHER" });
    (prisma.project.findFirst as any).mockResolvedValue({ id: "p_fallback", userId: "u1" });
    const cookie = signProjectCookie("p1");
    const fakeReq = {
      cookies: { get: () => ({ value: cookie }) },
    } as any;
    const project = await getActiveProject(fakeReq);
    expect(project?.id).toBe("p_fallback");
  });

  it("fallback al primo progetto se no cookie", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1" } });
    (prisma.project.findFirst as any).mockResolvedValue({ id: "p_first", userId: "u1" });
    const fakeReq = { cookies: { get: () => undefined } } as any;
    const project = await getActiveProject(fakeReq);
    expect(project?.id).toBe("p_first");
  });

  it("ritorna null se user senza progetti", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1" } });
    (prisma.project.findFirst as any).mockResolvedValue(null);
    const fakeReq = { cookies: { get: () => undefined } } as any;
    expect(await getActiveProject(fakeReq)).toBeNull();
  });

  it("ritorna null se non autenticato", async () => {
    (auth as any).mockResolvedValue(null);
    const fakeReq = { cookies: { get: () => undefined } } as any;
    expect(await getActiveProject(fakeReq)).toBeNull();
  });
});
