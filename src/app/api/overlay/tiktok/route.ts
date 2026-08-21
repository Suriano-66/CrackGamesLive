import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Enregistre le pseudo TikTok de l'utilisateur (celui dont on écoute le live).
const schema = z.object({
  username: z
    .string()
    .trim()
    .max(30)
    .transform((s) => s.replace(/^@+/, "")) // retire le @ de tête
    .refine((s) => s === "" || /^[a-zA-Z0-9._]+$/.test(s), {
      message: "Pseudo TikTok invalide.",
    }),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides." },
      { status: 400 },
    );
  }

  const username = parsed.data.username || null;
  await prisma.user.update({
    where: { id: session.user.id },
    data: { tiktokUsername: username },
  });

  return NextResponse.json({ ok: true, username });
}
