import { prisma } from "@/lib/prisma";

// Jeux par défaut du catalogue (utilisés pour l'amorçage / seed).
export const DEFAULT_GAMES = [
  {
    slug: "grande-course",
    title: "La grande course",
    emoji: "🏁",
    description:
      "Des concurrents s'affrontent sur une piste, un gagnant est désigné, puis ça repart.",
    order: 1,
  },
  {
    slug: "battle-equipes",
    title: "Battle des équipes",
    emoji: "⚔️",
    description:
      "Deux camps s'affrontent, les barres montent, un vainqueur est couronné à chaque manche.",
    order: 2,
  },
  {
    slug: "roue-fortune",
    title: "Roue de la fortune",
    emoji: "🎡",
    description:
      "La roue tourne toute seule à intervalle régulier et s'arrête sur un mot, un défi ou un prix.",
    order: 3,
  },
  {
    slug: "machine-a-sous",
    title: "Machine à sous",
    emoji: "🎰",
    description:
      "Les rouleaux tournent en continu. Jackpots et quasi-jackpots pour garder l'attention.",
    order: 4,
  },
  {
    slug: "compte-a-rebours",
    title: "Compte à rebours défi",
    emoji: "⏱️",
    description:
      "Un chrono lance un défi, affiche l'objectif, puis relance un nouveau round.",
    order: 5,
  },
  {
    slug: "compagnon-live",
    title: "Le compagnon du live",
    emoji: "🥚",
    description:
      "Une mascotte qui évolue heure après heure. Les viewers reviennent voir son évolution.",
    order: 6,
  },
];

export async function getEnabledGames() {
  return prisma.game.findMany({
    where: { enabled: true },
    orderBy: { order: "asc" },
  });
}

export async function getAllGames() {
  return prisma.game.findMany({ orderBy: { order: "asc" } });
}
