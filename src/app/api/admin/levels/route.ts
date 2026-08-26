import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/rbac";
import { getGameType } from "@/lib/gameTypes";

// L'app de bureau "Studio" s'authentifie avec une clé partagée (STUDIO_API_KEY)
// via l'en-tête x-studio-key, au lieu d'une session web.
function studioOK(req: Request) {
  const k = process.env.STUDIO_API_KEY;
  return !!k && req.headers.get("x-studio-key") === k;
}

// Liste les niveaux (staff ou studio).
export async function GET(req: Request) {
  if (!studioOK(req)) {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }
  }
  const levels = await prisma.level.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json({ levels });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(60),
  gameType: z.string().default("marble-race"),
});

// Crée un niveau (admin ou studio) initialisé avec le circuit par défaut.
export async function POST(req: Request) {
  if (!studioOK(req)) {
    const session = await auth();
    if (!session?.user?.id || !isAdmin(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    }
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
    },
  });
  return NextResponse.json({ ok: true, level });
}
