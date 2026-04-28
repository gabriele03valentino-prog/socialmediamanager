import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/active-project", () => ({
  withProjectRoute: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    trend: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { POST } from "./route";
import { auth } from "@/auth";
import { withProjectRoute } from "@/lib/active-project";
import { prisma } from "@/lib/db";

const project = { id: "proj1", kind: "ARTIST", niche: null, displayName: "Test" };

function makeReq(body: unknown): any {
  return new Request("http://localhost/api/trends", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  (withProjectRoute as any).mockImplementation(async (_req: any, fn: any) => fn(project));
});

describe("POST /api/trends", () => {
  it("401 if not authenticated", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await POST(makeReq({ kind: "SOUND", name: "X", platforms: ["TIKTOK"] }));
    expect(res.status).toBe(401);
    expect(withProjectRoute).not.toHaveBeenCalled();
  });

  it("400 on invalid body (missing platforms)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1" } });
    const res = await POST(makeReq({ kind: "SOUND", name: "X" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_body");
  });

  it("201 create with generatedBy=manual", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1" } });
    (prisma.trend.create as any).mockResolvedValue({ id: "t_new", name: "X" });
    const res = await POST(
      makeReq({
        kind: "SOUND",
        name: "  Sound new  ",
        platforms: ["TIKTOK", "INSTAGRAM"],
      }),
    );
    expect(res.status).toBe(201);
    expect(prisma.trend.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: "proj1",
        kind: "SOUND",
        name: "Sound new",
        platforms: ["TIKTOK", "INSTAGRAM"],
        status: "ACTIVE",
        generatedBy: "manual",
      }),
    });
  });
});
