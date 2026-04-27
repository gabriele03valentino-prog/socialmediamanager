import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    project: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}));

import { PATCH, DELETE } from "./route";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function makePatchReq(body: any): Request {
  return new Request("http://localhost/api/projects/p1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const params = Promise.resolve({ id: "p1" });

describe("PATCH /api/projects/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 if not auth", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await PATCH(makePatchReq({ displayName: "X" }), { params });
    expect(res.status).toBe(401);
  });

  it("404 if project not found", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1" } });
    (prisma.project.findUnique as any).mockResolvedValue(null);
    const res = await PATCH(makePatchReq({ displayName: "X" }), { params });
    expect(res.status).toBe(404);
  });

  it("404 if cross-user (no info leak)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1" } });
    (prisma.project.findUnique as any).mockResolvedValue({ id: "p1", userId: "OTHER" });
    const res = await PATCH(makePatchReq({ displayName: "X" }), { params });
    expect(res.status).toBe(404);
  });

  it("400 on invalid body", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1" } });
    (prisma.project.findUnique as any).mockResolvedValue({ id: "p1", userId: "u1" });
    const res = await PATCH(makePatchReq({ displayName: "" }), { params });
    expect(res.status).toBe(400);
  });

  it("400 rejects unknown keys (strict)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1" } });
    (prisma.project.findUnique as any).mockResolvedValue({ id: "p1", userId: "u1" });
    const res = await PATCH(makePatchReq({ malicious: "x" }), { params });
    expect(res.status).toBe(400);
  });

  it("200 success, trims displayName", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1" } });
    (prisma.project.findUnique as any).mockResolvedValue({ id: "p1", userId: "u1" });
    (prisma.project.update as any).mockResolvedValue({ id: "p1", displayName: "Trimmed" });
    const res = await PATCH(makePatchReq({ displayName: "  Trimmed  " }), { params });
    expect(res.status).toBe(200);
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { displayName: "Trimmed" },
    });
  });

  it("toggles emailFeedbackEnabled", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1" } });
    (prisma.project.findUnique as any).mockResolvedValue({ id: "p1", userId: "u1" });
    (prisma.project.update as any).mockResolvedValue({ id: "p1", emailFeedbackEnabled: false });
    const res = await PATCH(makePatchReq({ emailFeedbackEnabled: false }), { params });
    expect(res.status).toBe(200);
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { emailFeedbackEnabled: false },
    });
  });
});

describe("DELETE /api/projects/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 if not auth", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await DELETE(new Request("http://localhost"), { params });
    expect(res.status).toBe(401);
  });

  it("404 if not owned", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1" } });
    (prisma.project.findUnique as any).mockResolvedValue({ id: "p1", userId: "OTHER" });
    const res = await DELETE(new Request("http://localhost"), { params });
    expect(res.status).toBe(404);
  });

  it("200 cascade delete on success", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1" } });
    (prisma.project.findUnique as any).mockResolvedValue({ id: "p1", userId: "u1" });
    (prisma.project.delete as any).mockResolvedValue({ id: "p1" });
    const res = await DELETE(new Request("http://localhost"), { params });
    expect(res.status).toBe(200);
    expect(prisma.project.delete).toHaveBeenCalledWith({ where: { id: "p1" } });
  });
});
