import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

// Middleware Edge-safe: usa solo authConfig (niente adapter Prisma).
// La validazione della sessione avviene leggendo il JWT cookie.

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const pathname = req.nextUrl.pathname;
  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  if (isPublic) return NextResponse.next();
  if (!req.auth) {
    // API routes ritornano 401 JSON (i client non seguono redirect HTML)
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  // Escludiamo i file statici di Next.js E qualsiasi file con estensione
  // alla root (.txt, .xml, .json, .png, .ico, ecc.). Questo evita che il
  // middleware redireziona al login le request a file di verifica dei
  // domini (TikTok, Facebook, Google), robots.txt, sitemap.xml ecc.,
  // serviti da public/.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
