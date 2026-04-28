import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/active-project", () => ({
  withProjectRoute: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    postMortem: {
      findMany: vi.fn(),
    },
  },
}));

import { GET } from "./route";
import { auth } from "@/auth";
import { withProjectRoute } from "@/lib/active-project";
import { prisma } from "@/lib/db";

const project = { id: "proj1", kind: "ARTIST", niche: null, displayName: "Test" };

function makeReq(url: string): any {
  return new Request(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  (withProjectRoute as any).mockImplementation(async (_req: any, fn: any) => fn(project));
});

describe("GET /api/post-mortems", () => {
  it("401 if not authenticated", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET(makeReq("http://localhost/api/post-mortems"));
    expect(res.status).toBe(401);
    expect(withProjectRoute).not.toHaveBeenCalled();
  });

  it("returns post-mortems list", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1" } });
    const sample = [
      { id: "m1", projectId: "proj1", outcome: "OUTLIER_HIGH", platform: "TIKTOK" },
      { id: "m2", projectId: "proj1", outcome: "NORMAL", platform: "INSTAGRAM" },
    ];
    (prisma.postMortem.findMany as any).mockResolvedValue(sample);
    const res = await GET(makeReq("http://localhost/api/post-mortems"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.postMortems).toEqual(sample);
    expect(prisma.postMortem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: "proj1" },
        orderBy: { createdAt: "desc" },
        take: 50,
        skip: 0,
      }),
    );
  });

  it("filters by outcome query param", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1" } });
    (prisma.postMortem.findMany as any).mockResolvedValue([]);
    const res = await GET(
      makeReq("http://localhost/api/post-mortems?outcome=OUTLIER_HIGH&platform=TIKTOK"),
    );
    expect(res.status).toBe(200);
    expect(prisma.postMortem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projectId: "proj1",
          outcome: "OUTLIER_HIGH",
          platform: "TIKTOK",
        },
      }),
    );
  });
});
