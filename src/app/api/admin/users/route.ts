import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/rbac";

const schema = z.object({
  userId: z.string().min(1),
  role: z.enum(["user", "support", "admin"]),
});

// Change le rôle d'un utilisateur. Réservé aux admins.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }

  const { userId, role } = parsed.data;

  // Sécurité : un admin ne peut pas modifier son propre rôle (anti-verrouillage).
  if (userId === session.user.id) {
    return NextResponse.json(
      { error: "Tu ne peux pas modifier ton propre rôle." },
      { status: 400 },
    );
  }

  await prisma.user.update({ where: { id: userId }, data: { role } });
  return NextResponse.json({ ok: true });
}
