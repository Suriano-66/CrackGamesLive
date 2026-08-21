import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

// Jeton secret (non devinable) pour les liens overlay OBS.
export function generateOverlayToken(): string {
  return randomBytes(24).toString("base64url");
}

// Renvoie le jeton existant, ou en crée un si l'utilisateur n'en a pas.
export async function getOrCreateOverlayToken(
  userId: string,
  existing?: string | null,
): Promise<string> {
  if (existing) return existing;
  const token = generateOverlayToken();
  await prisma.user.update({
    where: { id: userId },
    data: { overlayToken: token },
  });
  return token;
}

// Régénère le jeton (révoque tous les anciens liens).
export async function resetOverlayToken(userId: string): Promise<string> {
  const token = generateOverlayToken();
  await prisma.user.update({
    where: { id: userId },
    data: { overlayToken: token },
  });
  return token;
}
