import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resetOverlayToken } from "@/lib/overlay";

// Régénère le jeton overlay de l'utilisateur connecté (révoque ses anciens liens).
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  const token = await resetOverlayToken(session.user.id);
  return NextResponse.json({ ok: true, token });
}
