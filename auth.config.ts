import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Config edge-safe: NIENTE adapter Prisma qui, altrimenti il middleware
// (che gira su Edge Runtime) esplode. L'adapter sta in auth.ts.
// Auth.js v5 legge automaticamente AUTH_GOOGLE_ID e AUTH_GOOGLE_SECRET
// dall'ambiente, quindi non serve passarli esplicitamente.

function isEmailAllowed(email: string | null | undefined): boolean {
  const raw = process.env.AUTH_ALLOWED_EMAILS ?? "";
  // Lista vuota = accesso libero (utile in dev). In produzione popola la
  // env var per chiudere il login solo agli email indicati.
  if (!raw.trim()) return true;
  if (!email) return false;
  const list = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export const authConfig = {
  providers: [Google],
  pages: { signIn: "/login" },
  callbacks: {
    // Email allowlist: blocca al callback OAuth tutti gli email non autorizzati.
    // Se l'email non è in lista, NextAuth mostra /api/auth/error?error=AccessDenied.
    signIn({ user }) {
      return isEmailAllowed(user.email);
    },
    // Usato dal middleware per decidere se una richiesta è autenticata.
    authorized({ auth, request }) {
      const pathname = request.nextUrl.pathname;
      const isPublic =
        pathname.startsWith("/login") ||
        pathname.startsWith("/privacy") ||
        pathname.startsWith("/terms") ||
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
