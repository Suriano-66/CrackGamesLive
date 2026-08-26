import type { NextAuthConfig } from "next-auth";

// Rôles autorisés à accéder au back-office /admin.
const STAFF_ROLES = ["admin", "support"];

// Configuration "edge-safe" partagée : pas de dépendances Node (bcrypt,
// Prisma) ici, pour que le middleware puisse tourner sur l'edge runtime.
// Le provider Credentials (qui a besoin de la base) est ajouté dans auth.ts.
export const authConfig = {
  // Nécessaire derrière un proxy (Render, Railway, etc.) : sans ça Auth.js
  // rejette les requêtes avec "UntrustedHost" en production.
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // Protège les routes /dashboard et /admin.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const role = (auth?.user as { role?: string } | undefined)?.role;
      const path = nextUrl.pathname;

      if (path.startsWith("/admin")) {
        return isLoggedIn && !!role && STAFF_ROLES.includes(role);
      }
      if (path.startsWith("/dashboard")) {
        return isLoggedIn;
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = (user as { id?: string }).id;
        token.role = (user as { role?: string }).role ?? "user";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        if (token?.id) session.user.id = token.id as string;
        session.user.role = (token.role as string) ?? "user";
      }
      return session;
    },
  },
  providers: [], // renseigné dans auth.ts
} satisfies NextAuthConfig;
