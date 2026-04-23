import { NextResponse } from "next/server";
import type { Platform } from "@prisma/client";
import { auth } from "@/auth";

const VALID: Record<string, Platform> = {
  instagram: "INSTAGRAM",
  facebook: "FACEBOOK",
  tiktok: "TIKTOK",
  youtube: "YOUTUBE",
  spotify: "SPOTIFY",
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { platform: raw } = await params;
  const platform = VALID[raw.toLowerCase()];
  if (!platform) {
    return NextResponse.json({ error: "unknown platform" }, { status: 404 });
  }

  // IG e FB condividono lo stesso flusso OAuth Meta.
  if (platform === "INSTAGRAM" || platform === "FACEBOOK") {
    const origin = new URL(req.url).origin;
    return NextResponse.redirect(`${origin}/api/connect/meta/start`);
  }

  return NextResponse.json(
    {
      ok: false,
      message: `Connettore ${platform} in arrivo (vedi milestone in README).`,
      platform,
    },
    { status: 501 },
  );
}
