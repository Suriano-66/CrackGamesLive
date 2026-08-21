// Promeut un compte existant en admin (ou tout autre rôle).
// Usage : npm run make-admin -- ton-email@example.com [role]
//   role optionnel : admin (défaut) | support | user
import { PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile(".env");
} catch {
  /* .env optionnel */
}

const email = process.argv[2];
const role = process.argv[3] ?? "admin";

if (!email) {
  console.error("Usage : npm run make-admin -- ton-email@example.com [admin|support|user]");
  process.exit(1);
}
if (!["admin", "support", "user"].includes(role)) {
  console.error(`Rôle invalide : ${role} (attendu : admin, support ou user)`);
  process.exit(1);
}

const prisma = new PrismaClient();
const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

if (!user) {
  console.error(`Aucun compte trouvé pour ${email}. Crée d'abord le compte sur le site.`);
  await prisma.$disconnect();
  process.exit(1);
}

await prisma.user.update({ where: { id: user.id }, data: { role } });
console.log(`✔ ${email} est maintenant : ${role}`);
console.log("→ Déconnecte-toi puis reconnecte-toi pour que le nouveau rôle prenne effet.");
await prisma.$disconnect();
