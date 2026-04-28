import { createHmac, timingSafeEqual } from "node:crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import type { Project } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { cookies as nextCookies } from "next/headers";

export class NoActiveProjectError extends Error {
  status = 412 as const;
  constructor() {
    super("NO_ACTIVE_PROJECT");
  }
}

export class ProjectNotOwnedError extends Error {
  status = 404 as const;
  constructor() {
    super("PROJECT_NOT_OWNED");
  }
}

function getSecret(): Buffer {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET non configurato");
  return Buffer.from(s, "utf8");
}

function hmac(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

export function signProjectCookie(projectId: string): string {
  return `${projectId}.${hmac(projectId)}`;
}

export function verifyProjectCookie(cookie: string | undefined | null): string | null {
  if (!cookie) return null;
  const idx = cookie.lastIndexOf(".");
  if (idx <= 0) return null;
  const projectId = cookie.slice(0, idx);
  const sig = cookie.slice(idx + 1);
  if (!projectId || !sig) return null;
  const expected = hmac(projectId);
  if (sig.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return null;
  } catch {
    return null;
  }
  return projectId;
}

export const ACTIVE_PROJECT_COOKIE = "active_project_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

interface MinimalReq {
  cookies: { get: (name: string) => { value: string } | undefined };
}

export async function getActiveProject(req?: MinimalReq): Promise<Project | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  let cookieVal: string | undefined;
  if (req?.cookies?.get) {
    cookieVal = req.cookies.get(ACTIVE_PROJECT_COOKIE)?.value;
  } else {
    try {
      const store = await nextCookies();
      cookieVal = store.get(ACTIVE_PROJECT_COOKIE)?.value;
    } catch {
      cookieVal = undefined;
    }
  }

  const projectId = verifyProjectCookie(cookieVal);
  if (projectId) {
    const proj = await prisma.project.findUnique({ where: { id: projectId } });
    if (proj && proj.userId === userId) return proj;
  }

  return prisma.project.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

export async function requireActiveProject(req?: MinimalReq): Promise<Project> {
  const proj = await getActiveProject(req);
  if (!proj) {
    throw new NoActiveProjectError();
  }
  return proj;
}

export async function setActiveProjectCookie(
  res: NextResponse,
  userId: string,
  projectId: string,
): Promise<void> {
  const proj = await prisma.project.findUnique({ where: { id: projectId } });
  if (!proj || proj.userId !== userId) {
    throw new ProjectNotOwnedError();
  }
  res.cookies.set({
    name: ACTIVE_PROJECT_COOKIE,
    value: signProjectCookie(projectId),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function withProject<T>(
  req: NextRequest,
  fn: (project: Project) => Promise<T>,
): Promise<T> {
  const project = await requireActiveProject(req);
  return fn(project);
}

export async function withProjectRoute(
  req: NextRequest,
  fn: (project: Project) => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await withProject(req, fn);
  } catch (e) {
    if (e instanceof NoActiveProjectError) {
      return NextResponse.json({ error: "no_active_project" }, { status: 412 });
    }
    throw e;
  }
}

// OAuth state HMAC: serializza un payload (es. {userId, projectId, platform})
// e lo firma con AUTH_SECRET. Usato dai connect/* per propagare projectId
// attraverso il round-trip OAuth in modo tamper-proof.
export function signOAuthState(payload: Record<string, string>): string {
  const json = JSON.stringify(payload);
  const sig = createHmac("sha256", getSecret()).update(json).digest("hex");
  return Buffer.from(`${json}.${sig}`).toString("base64url");
}

export function verifyOAuthState(
  state: string,
): Record<string, string> | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const idx = decoded.lastIndexOf(".");
    if (idx <= 0) return null;
    const json = decoded.slice(0, idx);
    const sig = decoded.slice(idx + 1);
    const expected = createHmac("sha256", getSecret()).update(json).digest("hex");
    if (sig.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) {
      return null;
    }
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, string>;
  } catch {
    return null;
  }
}
