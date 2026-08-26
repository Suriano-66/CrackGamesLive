import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { studioIdentity } from "@/lib/studioAuth";
import { isStaff } from "@/lib/rbac";
import { hasActiveAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

// Maps disponibles pour l'app Streamer (abonnés actifs / staff).
export async function GET(req: Request) {
  const who = await studioIdentity(req);
  if (!who) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  // Le staff passe ; sinon on revérifie l'abonnement en base.
  if (!isStaff(who.role) && who.id) {
    const u = await prisma.user.findUnique({
      where: { id: who.id },
      select: { subscriptionStatus: true, manualAccess: true },
    });
    if (!u || (!u.manualAccess && !hasActiveAccess(u.subscriptionStatus))) {
      return NextResponse.json({ error: "Abonnement inactif." }, { status: 403 });
    }
  }
  const rows = await prisma.level.findMany({
    orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
    select: { id: true, name: true, data: true, active: true },
  });
  return NextResponse.json({ levels: rows });
}
