// Amorce le catalogue avec les jeux de base (idempotent).
// Usage : npm run seed
import { PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile(".env");
} catch {
  /* .env optionnel si les variables sont déjà définies */
}

const prisma = new PrismaClient();

const GAMES = [
  { slug: "grande-course", title: "La grande course", emoji: "🏁", description: "Des concurrents s'affrontent sur une piste, un gagnant est désigné, puis ça repart.", order: 1 },
  { slug: "battle-equipes", title: "Battle des équipes", emoji: "⚔️", description: "Deux camps s'affrontent, les barres montent, un vainqueur est couronné à chaque manche.", order: 2 },
  { slug: "roue-fortune", title: "Roue de la fortune", emoji: "🎡", description: "La roue tourne toute seule et s'arrête sur un mot, un défi ou un prix.", order: 3 },
  { slug: "machine-a-sous", title: "Machine à sous", emoji: "🎰", description: "Les rouleaux tournent en continu. Jackpots et quasi-jackpots pour garder l'attention.", order: 4 },
  { slug: "compte-a-rebours", title: "Compte à rebours défi", emoji: "⏱️", description: "Un chrono lance un défi, affiche l'objectif, puis relance un nouveau round.", order: 5 },
  { slug: "compagnon-live", title: "Le compagnon du live", emoji: "🥚", description: "Une mascotte qui évolue heure après heure ; les viewers reviennent voir son évolution.", order: 6 },
];

for (const g of GAMES) {
  await prisma.game.upsert({
    where: { slug: g.slug },
    update: { title: g.title, emoji: g.emoji, description: g.description, order: g.order },
    create: g,
  });
  console.log("✔", g.emoji, g.title);
}

console.log(`\n${GAMES.length} jeux prêts dans le catalogue.`);
await prisma.$disconnect();
