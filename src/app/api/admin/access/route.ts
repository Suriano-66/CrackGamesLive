import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/rbac";

const schema = z.object({
  userId: z.string().min(1),
  // plan null => révoquer l'accès offert
  plan: z.enum(["starter", "creator", "pro"]).nullable(),
  duration: z.enum(["1m", "3m", "1y", "unlimited"]).default("1m"),
});

function periodEnd(duration: string): Date | null {
  if (duration === "unlimited") return null;
  const d = new Date();
  if (duration === "1m") d.setMonth(d.getMonth() + 1);
  else if (duration === "3m") d.setMonth(d.getMonth() + 3);
  else if (duration === "1y") d.setFullYear(d.getFullYear() + 1);
  return d;
}

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

  const { userId, plan, duration } = parsed.data;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
  }

  // Révocation d'un accès offert.
  if (plan === null) {
    if (!user.manualAccess) {
      return NextResponse.json(
        {
          error:
            "Aucun accès offert à révoquer. Un abonnement Stripe se gère depuis Stripe.",
        },
        { status: 400 },
      );
    }
    await prisma.user.update({
      where: { id: userId },
      data: {
        plan: null,
        subscriptionStatus: null,
        currentPeriodEnd: null,
        manualAccess: false,
      },
    });
    return NextResponse.json({ ok: true, revoked: true });
  }

  // On ne remplace pas un abonnement Stripe payant par un accès offert.
  if (user.stripeSubscriptionId) {
    return NextResponse.json(
      {
        error:
          "Cet utilisateur a déjà un abonnement Stripe actif. Gère-le depuis Stripe.",
      },
      { status: 400 },
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      plan,
      subscriptionStatus: "active",
      currentPeriodEnd: periodEnd(duration),
      manualAccess: true,
    },
  });

  return NextResponse.json({ ok: true, granted: true });
}
