import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { signOAuthState, withProjectRoute } from "@/lib/active-project";
import { authorizeUrl } from "@/lib/platforms/youtube-oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return withProjectRoute(req, async (project) => {
    const clientId = process.env.AUTH_GOOGLE_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: "AUTH_GOOGLE_ID non configurata" },
        { status: 500 },
      );
    }

    const reqUrl = new URL(req.url);
    const origin = reqUrl.origin;
    const redirectUri = `${origin}/api/connect/youtube/callback`;
    const nextParam = reqUrl.searchParams.get("next");
    const nextUrl =
      nextParam && nextParam.startsWith("/") ? nextParam : "/impostazioni";
    const state = signOAuthState({
      userId: session.user!.id!,
      projectId: project.id,
      platform: "youtube",
      next: nextUrl,
    });
    const url = authorizeUrl({ clientId, redirectUri, state });
    return NextResponse.redirect(url);
  });
}
