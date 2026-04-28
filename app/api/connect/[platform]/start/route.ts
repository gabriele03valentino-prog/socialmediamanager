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

  const reqUrl = new URL(req.url);
  const origin = reqUrl.origin;
  const nextParam = reqUrl.searchParams.get("next");
  const nextQs =
    nextParam && nextParam.startsWith("/")
      ? `?next=${encodeURIComponent(nextParam)}`
      : "";

  // IG e FB condividono lo stesso flusso OAuth Meta.
  if (platform === "INSTAGRAM" || platform === "FACEBOOK") {
    return NextResponse.redirect(`${origin}/api/connect/meta/start${nextQs}`);
  }

  // YouTube ha la sua route dedicata.
  if (platform === "YOUTUBE") {
    return NextResponse.redirect(`${origin}/api/connect/youtube/start${nextQs}`);
  }

  // TikTok idem.
  if (platform === "TIKTOK") {
    return NextResponse.redirect(`${origin}/api/connect/tiktok/start${nextQs}`);
  }

  // Spotify: non serve OAuth lato utente, l'utente incolla l'URL artista in
  // una pagina dedicata.
  if (platform === "SPOTIFY") {
    return NextResponse.redirect(`${origin}/impostazioni/spotify`);
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
