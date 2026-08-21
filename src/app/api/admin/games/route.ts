import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/rbac";

const createSchema = z.object({
  title: z.string().trim().min(2).max(80),
  emoji: z.string().trim().min(1).max(8).default("🎮"),
  description: z.string().trim().max(300).default(""),
});

const patchSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Crée un jeu. Réservé aux admins.
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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }

  const { title, emoji, description } = parsed.data;
  const base = slugify(title) || "jeu";
  let slug = base;
  let n = 1;
  while (await prisma.game.findUnique({ where: { slug } })) {
    slug = `${base}-${n++}`;
  }

  const max = await prisma.game.aggregate({ _max: { order: true } });
  const game = await prisma.game.create({
    data: {
      slug,
      title,
      emoji,
      description,
      order: (max._max.order ?? 0) + 1,
    },
  });
  return NextResponse.json({ ok: true, game });
}

// Active / désactive un jeu. Réservé aux admins.
export async function PATCH(req: Request) {
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

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }

  await prisma.game.update({
    where: { id: parsed.data.id },
    data: { enabled: parsed.data.enabled },
  });
  return NextResponse.json({ ok: true });
}
