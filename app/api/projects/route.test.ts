import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    project: { findMany: vi.fn(), create: vi.fn(), count: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

import { GET, POST } from "./route";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function makeReq(body: any): Request {
  return new Request("http://localhost/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("401 if not authenticated", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns user's projects ordered asc", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1" } });
    (prisma.project.findMany as any).mockResolvedValue([{ id: "p1" }, { id: "p2" }]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.projects).toHaveLength(2);
    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u1" },
        orderBy: { createdAt: "asc" },
      })
    );
  });
});

describe("POST /api/projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.EMAIL_ALLOWLIST;
  });

  it("401 if not authenticated", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await POST(makeReq({ kind: "ARTIST", displayName: "Test" }));
    expect(res.status).toBe(401);
  });

  it("400 on invalid body (missing displayName)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1" } });
    const res = await POST(makeReq({ kind: "ARTIST" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_body");
  });

  it("400 on invalid kind enum", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1" } });
    const res = await POST(makeReq({ kind: "INVALID", displayName: "X" }));
    expect(res.status).toBe(400);
  });

  it("403 max_projects_reached when at cap, not allowlisted", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1" } });
    (prisma.user.findUnique as any).mockResolvedValue({ email: "u@test.io" });
    (prisma.project.count as any).mockResolvedValue(5);
    const res = await POST(makeReq({ kind: "ARTIST", displayName: "Test" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("max_projects_reached");
    expect(body.limit).toBe(5);
  });

  it("201 on successful create", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1" } });
    (prisma.user.findUnique as any).mockResolvedValue({ email: "u@test.io" });
    (prisma.project.count as any).mockResolvedValue(2);
    (prisma.project.create as any).mockResolvedValue({ id: "p_new", displayName: "Test" });
    const res = await POST(makeReq({ kind: "ARTIST", displayName: "  Test  " }));
    expect(res.status).toBe(201);
    expect(prisma.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "u1",
          kind: "ARTIST",
          displayName: "Test", // trimmed
        }),
      })
    );
  });

  it("201 even at high count if allowlisted", async () => {
    process.env.EMAIL_ALLOWLIST = "owner@test.io";
    (auth as any).mockResolvedValue({ user: { id: "u1" } });
    (prisma.user.findUnique as any).mockResolvedValue({ email: "owner@test.io" });
    (prisma.project.count as any).mockResolvedValue(99);
    (prisma.project.create as any).mockResolvedValue({ id: "p_new" });
    const res = await POST(makeReq({ kind: "PODCASTER", displayName: "Cast" }));
    expect(res.status).toBe(201);
  });

  it("400 rejects unknown body keys (strict schema)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1" } });
    const res = await POST(makeReq({ kind: "ARTIST", displayName: "Test", maliciousField: "x" }));
    expect(res.status).toBe(400);
  });
});
