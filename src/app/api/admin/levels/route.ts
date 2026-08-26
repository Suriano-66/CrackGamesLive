import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isStaff } from "@/lib/rbac";
import { getGameType } from "@/lib/gameTypes";
import { caller, lockInfo } from "@/lib/levelApi";

export const dynamic = "force-dynamic";

// Liste les niveaux (staff / studio).
export async function GET(req: Request) {
  const who = await caller(req);
  if (!who) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const rows = await prisma.level.findMany({ orderBy: { updatedAt: "desc" } });
  type Row = {
    id: string;
    gameType: string;
    name: string;
    data: string;
    active: boolean;
    createdByName: string | null;
    updatedByName: string | null;
    updatedAt: Date;
    lockedByName: string | null;
    lockedById: string | null;
    lockedAt: Date | null;
  };
  const levels = (rows as Row[]).map((l) => ({
    id: l.id,
    gameType: l.gameType,
    name: l.name,
    data: l.data,
    active: l.active,
    createdByName: l.createdByName,
    updatedByName: l.updatedByName,
    updatedAt: l.updatedAt,
    ...lockInfo(l),
  }));
  return NextResponse.json({ levels });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(60),
  gameType: z.string().default("marble-race"),
});

// Crée un niveau (staff / studio).
export async function POST(req: Request) {
  const who = await caller(req);
  if (!who || !isStaff(who.role)) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }
  const gt = getGameType(parsed.data.gameType);
  if (!gt) {
    return NextResponse.json({ error: "Type de jeu inconnu." }, { status: 400 });
  }
  const level = await prisma.level.create({
    data: {
      name: parsed.data.name,
      gameType: gt.id,
      data: JSON.stringify({ platforms: gt.defaultPlatforms, settings: {} }),
      createdById: who.id,
      createdByName: who.name,
      updatedById: who.id,
      updatedByName: who.name,
    },
  });
  return NextResponse.json({ ok: true, level });
}
