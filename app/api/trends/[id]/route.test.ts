import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/active-project", () => ({
  withProjectRoute: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    trend: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { PATCH } from "./route";
import { auth } from "@/auth";
import { withProjectRoute } from "@/lib/active-project";
import { prisma } from "@/lib/db";

const project = { id: "proj1", kind: "ARTIST", niche: null, displayName: "Test" };
const params = Promise.resolve({ id: "t1" });

function makeReq(body?: unknown): any {
  return new Request("http://localhost/api/trends/t1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  (withProjectRoute as any).mockImplementation(async (_req: any, fn: any) => fn(project));
});

describe("PATCH /api/trends/[id]", () => {
  it("404 if trend belongs to a different project (no info leak)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1" } });
    (prisma.trend.findUnique as any).mockResolvedValue({
      id: "t1",
      projectId: "OTHER_PROJECT",
    });
    const res = await PATCH(makeReq({ status: "EXPIRED" }), { params });
    expect(res.status).toBe(404);
    expect(prisma.trend.update).not.toHaveBeenCalled();
  });

  it("200 success on status update", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1" } });
    (prisma.trend.findUnique as any).mockResolvedValue({
      id: "t1",
      projectId: "proj1",
    });
    (prisma.trend.update as any).mockResolvedValue({ id: "t1", status: "EXPIRED" });
    const res = await PATCH(makeReq({ status: "EXPIRED" }), { params });
    expect(res.status).toBe(200);
    expect(prisma.trend.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: expect.objectContaining({ status: "EXPIRED" }),
    });
  });
});
