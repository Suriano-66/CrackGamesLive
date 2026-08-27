import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isStaff } from "@/lib/rbac";
import { parseLevelData } from "@/lib/levels";
import { caller, lockActive, lockInfo, MAX_VERSIONS } from "@/lib/levelApi";

export const dynamic = "force-dynamic";

// Lit un seul niveau. Sert au suivi en direct du Studio : l'éditeur qui n'a pas
// la main interroge cette route pour rejouer, chez lui, le niveau tel que son
// collègue est en train de le construire — sans télécharger toute la liste.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const who = await caller(req);
  if (!who) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const { id } = await ctx.params;
  const l = await prisma.level.findUnique({ where: { id } });
  if (!l) return NextResponse.json({ error: "Niveau introuvable." }, { status: 404 });
  return NextResponse.json({
    level: {
      id: l.id,
      gameType: l.gameType,
      name: l.name,
      data: l.data,
      active: l.active,
      createdByName: l.createdByName,
      updatedByName: l.updatedByName,
      updatedAt: l.updatedAt,
      ...lockInfo(l),
    },
  });
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  platforms: z.array(z.record(z.any())).optional(),
  settings: z.record(z.any()).optional(),
  active: z.boolean().optional(),
  // Sauvegarde explicite → crée une entrée d'historique (sinon simple auto-save).
  snapshot: z.boolean().optional(),
  // Force l'écriture même si un autre éditeur détient le verrou.
  force: z.boolean().optional(),
});

// Met à jour un niveau (nom, plateformes, activation). Staff/studio.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const who = await caller(req);
  if (!who || !isStaff(who.role)) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides." }, { status: 400 });

  const level = await prisma.level.findUnique({ where: { id } });
  if (!level) return NextResponse.json({ error: "Niveau introuvable." }, { status: 404 });

  const editsContent = parsed.data.platforms !== undefined || parsed.data.settings !== undefined;

  // Verrou : refuse d'écraser si quelqu'un d'autre édite (sauf force / même personne).
  if (
    editsContent &&
    lockActive(level.lockedAt) &&
    level.lockedById &&
    who.id &&
    level.lockedById !== who.id &&
    !parsed.data.force
  ) {
    return NextResponse.json(
      { error: "locked", editingBy: level.lockedByName, editingById: level.lockedById },
      { status: 409 },
    );
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;

  if (editsContent) {
    const existing = parseLevelData(level.data);
    const platforms = parsed.data.platforms ?? existing.platforms;
    const settings = parsed.data.settings ?? existing.settings ?? {};
    data.data = JSON.stringify({ platforms, settings });
    data.updatedById = who.id;
    data.updatedByName = who.name;
    // Rafraîchit le verrou au nom de l'éditeur courant.
    data.lockedById = who.id;
    data.lockedByName = who.name;
    data.lockedAt = new Date();
  }

  // Sauvegarde explicite → snapshot d'historique (avant modification = état sûr).
  if (editsContent && parsed.data.snapshot) {
    await prisma.levelVersion.create({
      data: {
        levelId: id,
        data: typeof data.data === "string" ? (data.data as string) : level.data,
        savedById: who.id,
        savedByName: who.name,
      },
    });
    // Purge : ne garde que les MAX_VERSIONS plus récentes.
    const old = await prisma.levelVersion.findMany({
      where: { levelId: id },
      orderBy: { createdAt: "desc" },
      skip: MAX_VERSIONS,
      select: { id: true },
    });
    if (old.length) {
      await prisma.levelVersion.deleteMany({
        where: { id: { in: old.map((v: { id: string }) => v.id) } },
      });
    }
  }

  if (parsed.data.active === true) {
    await prisma.$transaction([
      prisma.level.updateMany({
        where: { gameType: level.gameType, active: true },
        data: { active: false },
      }),
      prisma.level.update({ where: { id }, data: { ...data, active: true } }),
    ]);
  } else {
    if (parsed.data.active === false) data.active = false;
    await prisma.level.update({ where: { id }, data });
  }
  return NextResponse.json({ ok: true });
}

// Supprime un niveau (staff/studio).
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const who = await caller(req);
  if (!who || !isStaff(who.role)) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const { id } = await ctx.params;
  await prisma.level.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
