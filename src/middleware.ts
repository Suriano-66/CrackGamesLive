import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Middleware edge-safe : n'utilise que la config sans dépendances Node.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Protège l'espace membre et le back-office.
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
