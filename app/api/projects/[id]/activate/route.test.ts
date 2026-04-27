import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/active-project", async (orig) => {
  const actual = await orig<typeof import("@/lib/active-project")>();
  return {
    ...actual,
    setActiveProjectCookie: vi.fn(),
  };
});

import { POST } from "./route";
import { auth } from "@/auth";
import { setActiveProjectCookie, ProjectNotOwnedError } from "@/lib/active-project";

const params = Promise.resolve({ id: "p1" });

describe("POST /api/projects/[id]/activate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 if not auth", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await POST(new Request("http://localhost"), { params });
    expect(res.status).toBe(401);
  });

  it("404 if cross-user (ProjectNotOwnedError)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1" } });
    (setActiveProjectCookie as any).mockRejectedValue(new ProjectNotOwnedError());
    const res = await POST(new Request("http://localhost"), { params });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("not_found");
  });

  it("200 + sets cookie on success", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1" } });
    (setActiveProjectCookie as any).mockResolvedValue(undefined);
    const res = await POST(new Request("http://localhost"), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, projectId: "p1" });
    expect(setActiveProjectCookie).toHaveBeenCalledWith(res, "u1", "p1");
  });

  it("rethrows unknown errors", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1" } });
    (setActiveProjectCookie as any).mockRejectedValue(new Error("DB_DOWN"));
    await expect(POST(new Request("http://localhost"), { params })).rejects.toThrow("DB_DOWN");
  });
});
