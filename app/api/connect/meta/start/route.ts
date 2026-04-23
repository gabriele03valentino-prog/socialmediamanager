import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { authorizeUrl } from "@/lib/platforms/meta-oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATE_COOKIE = "meta_oauth_state";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const clientId = process.env.META_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      {
        error: "META_CLIENT_ID non configurata. Vedi README → Setup → Meta.",
      },
      { status: 500 },
    );
  }

  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/connect/meta/callback`;
  const state = randomBytes(16).toString("hex");

  const url = authorizeUrl({ clientId, redirectUri, state });

  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minuti per completare il flusso
  });
  return res;
}
