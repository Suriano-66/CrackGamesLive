import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStaff } from "@/lib/rbac";
import { caller, lockActive } from "@/lib/levelApi";

export const dynamic = "force-dynamic";

// Prend / rafraîchit le verrou d'édition (heartbeat). 409 si déjà pris par un autre.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const who = await caller(req);
  if (!who || !isStaff(who.role)) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const force = !!body?.force;

  const level = await prisma.level.findUnique({ where: { id } });
  if (!level) return NextResponse.json({ error: "Niveau introuvable." }, { status: 404 });

  const heldByOther = lockActive(level.lockedAt) && level.lockedById && who.id && level.lockedById !== who.id;
  if (heldByOther && !force) {
    return NextResponse.json(
      { ok: false, error: "locked", editingBy: level.lockedByName, editingById: level.lockedById },
      { status: 409 },
    );
  }
  await prisma.level.update({
    where: { id },
    data: { lockedById: who.id, lockedByName: who.name, lockedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}

// Libère le verrou (si on le détient, ou admin).
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const who = await caller(req);
  if (!who || !isStaff(who.role)) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const { id } = await ctx.params;
  const level = await prisma.level.findUnique({ where: { id } });
  if (!level) return NextResponse.json({ ok: true });
  if (level.lockedById && who.id && level.lockedById !== who.id && who.role !== "admin") {
    // Pas notre verrou : on ne force pas (sauf admin).
    return NextResponse.json({ ok: true });
  }
  await prisma.level.update({
    where: { id },
    data: { lockedById: null, lockedByName: null, lockedAt: null },
  });
  return NextResponse.json({ ok: true });
}
