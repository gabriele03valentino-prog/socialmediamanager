import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { signOAuthState, withProjectRoute } from "@/lib/active-project";
import { authorizeUrl } from "@/lib/platforms/meta-oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return withProjectRoute(req, async (project) => {
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
    const state = signOAuthState({
      userId: session.user!.id!,
      projectId: project.id,
      platform: "meta",
    });

    const url = authorizeUrl({ clientId, redirectUri, state });
    return NextResponse.redirect(url);
  });
}
