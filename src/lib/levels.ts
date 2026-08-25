import { prisma } from "@/lib/prisma";
import type { Platform } from "@/lib/gameTypes";

export interface LevelData {
  platforms: Platform[];
  settings: Record<string, unknown>;
}

export function parseLevelData(data: string): LevelData {
  try {
    const d = JSON.parse(data);
    if (d && Array.isArray(d.platforms)) {
      return {
        platforms: d.platforms as Platform[],
        settings: d.settings && typeof d.settings === "object" ? d.settings : {},
      };
    }
  } catch {
    /* ignore */
  }
  return { platforms: [], settings: {} };
}

// Niveau actif d'un type de jeu (celui utilisé en live). null si aucun.
export async function getActiveLevel(gameType = "marble-race") {
  const lvl = await prisma.level.findFirst({
    where: { gameType, active: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!lvl) return null;
  return { id: lvl.id, name: lvl.name, ...parseLevelData(lvl.data) };
}
