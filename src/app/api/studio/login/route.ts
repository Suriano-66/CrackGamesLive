import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isStaff } from "@/lib/rbac";
import { hasActiveAccess } from "@/lib/access";
import { signStudioToken } from "@/lib/studioToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Connexion des applications de bureau (Studio éditeur / app Streamer) avec le
// compte du site. Renvoie un jeton à stocker et à renvoyer sur chaque appel.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const appKind = body?.app === "streamer" ? "streamer" : "studio";

  if (!email || !password) {
    return NextResponse.json({ error: "Email et mot de passe requis." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await bcrypt.compare(password, "$2a$10$invalidinvalidinvalidinvalidiu");
    return NextResponse.json({ error: "Identifiants invalides." }, { status: 401 });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Identifiants invalides." }, { status: 401 });
  }

  // Le Studio est réservé au staff ; l'app Streamer aux abonnés actifs.
  if (appKind === "studio" && !isStaff(user.role)) {
    return NextResponse.json(
      { error: "Le Studio est réservé aux administrateurs et au support." },
      { status: 403 },
    );
  }
  if (
    appKind === "streamer" &&
    !isStaff(user.role) &&
    !user.manualAccess &&
    !hasActiveAccess(user.subscriptionStatus)
  ) {
    return NextResponse.json(
      { error: "Abonnement inactif — réactive ton abonnement pour utiliser l'application." },
      { status: 403 },
    );
  }

  const token = await signStudioToken({
    sub: user.id,
    role: user.role,
    name: user.name ?? user.email,
    email: user.email,
  });

  return NextResponse.json({
    token,
    user: {
      id: user.id,
      name: user.name ?? null,
      email: user.email,
      role: user.role,
      overlayToken: user.overlayToken ?? null,
      tiktokUsername: user.tiktokUsername ?? null,
    },
  });
}
