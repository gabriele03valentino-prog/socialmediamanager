import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { signOAuthState, withProjectRoute } from "@/lib/active-project";
import { authorizeUrl, generatePkcePair } from "@/lib/platforms/tiktok-oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return withProjectRoute(req, async (project) => {
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    if (!clientKey) {
      return NextResponse.json(
        { error: "TIKTOK_CLIENT_KEY non configurata. Vedi README → TikTok." },
        { status: 500 },
      );
    }

    const reqUrl = new URL(req.url);
    const origin = reqUrl.origin;
    const redirectUri = `${origin}/api/connect/tiktok/callback`;
    console.log("[tiktok/start] redirect_uri sent:", redirectUri);
    const nextParam = reqUrl.searchParams.get("next");
    const nextUrl =
      nextParam && nextParam.startsWith("/") ? nextParam : "/impostazioni";
    const { verifier, challenge } = generatePkcePair();
    // Salviamo il verifier dentro lo state HMAC-firmato: tamper-proof,
    // niente bisogno di cookie temporaneo. TikTok ritornerà lo state al
    // callback dove estraiamo il verifier per il token exchange.
    const state = signOAuthState({
      userId: session.user!.id!,
      projectId: project.id,
      platform: "tiktok",
      next: nextUrl,
      cv: verifier,
    });
    const url = authorizeUrl({
      clientKey,
      redirectUri,
      state,
      codeChallenge: challenge,
    });
    return NextResponse.redirect(url);
  });
}
