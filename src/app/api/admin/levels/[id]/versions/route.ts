import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isStaff } from "@/lib/rbac";
import { caller } from "@/lib/levelApi";

export const dynamic = "force-dynamic";

// Historique des sauvegardes d'un niveau (récent → ancien).
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const who = await caller(req);
  if (!who || !isStaff(who.role)) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const { id } = await ctx.params;
  const versions = await prisma.levelVersion.findMany({
    where: { levelId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, savedByName: true, label: true, createdAt: true },
  });
  return NextResponse.json({ versions });
}

const restoreSchema = z.object({ versionId: z.string().min(1) });

// Restaure une version : le contenu du niveau redevient celui de la version.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const who = await caller(req);
  if (!who || !isStaff(who.role)) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = restoreSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides." }, { status: 400 });

  const version = await prisma.levelVersion.findUnique({ where: { id: parsed.data.versionId } });
  if (!version || version.levelId !== id) {
    return NextResponse.json({ error: "Version introuvable." }, { status: 404 });
  }
  // Sauvegarde l'état courant avant de restaurer (pour pouvoir annuler la restauration).
  const current = await prisma.level.findUnique({ where: { id } });
  if (current) {
    await prisma.levelVersion.create({
      data: { levelId: id, data: current.data, savedById: who.id, savedByName: who.name, label: "avant restauration" },
    });
  }
  await prisma.level.update({
    where: { id },
    data: { data: version.data, updatedById: who.id, updatedByName: who.name },
  });
  return NextResponse.json({ ok: true, data: version.data });
}
