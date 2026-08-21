import Stripe from "stripe";

// Client Stripe côté serveur uniquement. La clé secrète ne doit JAMAIS
// être exposée au navigateur.
const key = process.env.STRIPE_SECRET_KEY;

if (!key && process.env.NODE_ENV === "production") {
  // On ne jette pas d'erreur au build, mais on prévient clairement.
  console.warn("[stripe] STRIPE_SECRET_KEY manquant — les paiements échoueront.");
}

export const stripe = new Stripe(key ?? "sk_test_placeholder", {
  apiVersion: "2024-12-18.acacia",
  typescript: true,
  appInfo: { name: "CrackGamesLive" },
});
