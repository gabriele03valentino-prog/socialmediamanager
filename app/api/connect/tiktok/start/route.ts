import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { authorizeUrl } from "@/lib/platforms/tiktok-oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATE_COOKIE = "tiktok_oauth_state";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  if (!clientKey) {
    return NextResponse.json(
      { error: "TIKTOK_CLIENT_KEY non configurata. Vedi README → TikTok." },
      { status: 500 },
    );
  }

  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/connect/tiktok/callback`;
  const state = randomBytes(16).toString("hex");
  const url = authorizeUrl({ clientKey, redirectUri, state });

  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
