import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { encryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { fetchArtist, parseArtistId } from "@/lib/platforms/spotify-oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({ artistUrl: z.string().min(1) });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const contentType = req.headers.get("content-type") ?? "";
  let input: string;
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const fd = await req.formData();
    input = String(fd.get("artistUrl") ?? "");
  } else {
    const json = await req.json().catch(() => ({}));
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    input = parsed.data.artistUrl;
  }

  const artistId = parseArtistId(input);
  if (!artistId) {
    return redirectOrJson(req, { error: "invalid_url" }, 400);
  }

  try {
    const artist = await fetchArtist(artistId);
    await prisma.socialAccount.upsert({
      where: {
        userId_platform_externalId: {
          userId: session.user.id,
          platform: "SPOTIFY",
          externalId: artist.id,
        },
      },
      create: {
        userId: session.user.id,
        platform: "SPOTIFY",
        handle: artist.name,
        externalId: artist.id,
        accessTokenEnc: encryptToken(""),
        scopes: [],
        meta: {
          name: artist.name,
          popularity: artist.popularity,
          genres: artist.genres,
          url: artist.external_urls?.spotify,
          image: artist.images?.[0]?.url,
        },
      },
      update: {
        handle: artist.name,
        meta: {
          name: artist.name,
          popularity: artist.popularity,
          genres: artist.genres,
          url: artist.external_urls?.spotify,
          image: artist.images?.[0]?.url,
        },
        lastSyncError: null,
      },
    });
    return redirectOrJson(req, {
      connected: "spotify",
      artist: artist.name,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return redirectOrJson(req, { error: "spotify_lookup_failed", message }, 500);
  }
}

function redirectOrJson(
  req: Request,
  params: Record<string, string>,
  status = 200,
): NextResponse {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const origin = new URL(req.url).origin;
    const target = new URL("/impostazioni", origin);
    for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v);
    return NextResponse.redirect(target, 303);
  }
  return NextResponse.json({ ok: status === 200, ...params }, { status });
}
