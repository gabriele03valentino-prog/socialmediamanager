import { createHmac, timingSafeEqual } from "node:crypto";

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

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import type { Project } from "@prisma/client";
import type { NextRequest, NextResponse } from "next/server";
import { cookies as nextCookies } from "next/headers";

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
    const err = new Error("NO_ACTIVE_PROJECT");
    (err as any).status = 412;
    throw err;
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
    throw new Error("PROJECT_NOT_OWNED");
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
