import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { studioIdentity } from "@/lib/studioAuth";

export const dynamic = "force-dynamic";

// Config des cadeaux → billes, propre à chaque compte (app Streamer).
export async function GET(req: Request) {
  const who = await studioIdentity(req);
  if (!who || !who.id) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const u = await prisma.user.findUnique({ where: { id: who.id }, select: { giftConfig: true } });
  return NextResponse.json({ giftConfig: u?.giftConfig ?? null });
}

const schema = z.object({ config: z.record(z.any()) });

export async function POST(req: Request) {
  const who = await studioIdentity(req);
  if (!who || !who.id) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  await prisma.user.update({
    where: { id: who.id },
    data: { giftConfig: JSON.stringify(parsed.data.config) },
  });
  return NextResponse.json({ ok: true });
}
