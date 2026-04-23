import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Config edge-safe: NIENTE adapter Prisma qui, altrimenti il middleware
// (che gira su Edge Runtime) esplode. L'adapter sta in auth.ts.
// Auth.js v5 legge automaticamente AUTH_GOOGLE_ID e AUTH_GOOGLE_SECRET
// dall'ambiente, quindi non serve passarli esplicitamente.

export const authConfig = {
  providers: [Google],
  pages: { signIn: "/login" },
  callbacks: {
    // Usato dal middleware per decidere se una richiesta è autenticata.
    authorized({ auth, request }) {
      const pathname = request.nextUrl.pathname;
      const isPublic =
        pathname.startsWith("/login") ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/cron") ||
        pathname.startsWith("/_next") ||
        pathname === "/favicon.ico";
      if (isPublic) return true;
      return !!auth;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
