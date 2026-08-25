import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/rbac";
import { parseLevelData } from "@/lib/levels";

async function guard() {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session.user.role)) return null;
  return session;
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  // data = { platforms: [...], settings: {...} }
  platforms: z.array(z.record(z.any())).optional(),
  settings: z.record(z.any()).optional(),
  active: z.boolean().optional(),
});

// Met à jour un niveau (nom, pièces, activation). Admin.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await guard())) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }
  const level = await prisma.level.findUnique({ where: { id } });
  if (!level) return NextResponse.json({ error: "Niveau introuvable." }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.platforms !== undefined || parsed.data.settings !== undefined) {
    const existing = parseLevelData(level.data);
    const platforms = parsed.data.platforms ?? existing.platforms;
    const settings = parsed.data.settings ?? existing.settings ?? {};
    data.data = JSON.stringify({ platforms, settings });
  }

  if (parsed.data.active === true) {
    // Activation exclusive pour ce type de jeu.
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

// Supprime un niveau. Admin.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await guard())) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const { id } = await ctx.params;
  await prisma.level.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
