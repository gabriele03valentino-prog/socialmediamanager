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
