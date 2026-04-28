import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { signOAuthState, withProjectRoute } from "@/lib/active-project";
import { authorizeUrl } from "@/lib/platforms/tiktok-oauth";

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
    const nextParam = reqUrl.searchParams.get("next");
    const nextUrl =
      nextParam && nextParam.startsWith("/") ? nextParam : "/impostazioni";
    const state = signOAuthState({
      userId: session.user!.id!,
      projectId: project.id,
      platform: "tiktok",
      next: nextUrl,
    });
    const url = authorizeUrl({ clientKey, redirectUri, state });
    return NextResponse.redirect(url);
  });
}
