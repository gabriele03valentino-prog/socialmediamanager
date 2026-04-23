import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { authorizeUrl } from "@/lib/platforms/youtube-oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATE_COOKIE = "youtube_oauth_state";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const clientId = process.env.AUTH_GOOGLE_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "AUTH_GOOGLE_ID non configurata" },
      { status: 500 },
    );
  }

  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/connect/youtube/callback`;
  const state = randomBytes(16).toString("hex");
  const url = authorizeUrl({ clientId, redirectUri, state });

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
