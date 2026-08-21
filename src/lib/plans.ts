// Catalogue des offres et périodes de facturation.
// Les prix affichés ici sont indicatifs (à valider) ; les VRAIS montants
// facturés proviennent des "prices" configurés dans Stripe (voir priceId).

export type BillingInterval = "monthly" | "quarterly" | "yearly";
export type PlanId = "starter" | "creator" | "pro";

export const BILLING_LABELS: Record<BillingInterval, string> = {
  monthly: "Mensuel",
  quarterly: "Trimestriel",
  yearly: "Annuel",
};

// Réduction indicative appliquée sur le prix mensuel équivalent.
export const BILLING_DISCOUNT: Record<BillingInterval, number> = {
  monthly: 0,
  quarterly: 0.15,
  yearly: 0.3,
};

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  popular?: boolean;
  // Prix mensuel de référence (en euros) pour l'affichage.
  monthlyPrice: number;
  features: string[];
  // Map période -> variable d'env contenant l'ID de prix Stripe.
  priceEnv: Record<BillingInterval, string>;
}

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    description: "Pour tester et lancer tes premiers lives interactifs.",
    monthlyPrice: 9,
    features: [
      "5 jeux au choix",
      "Personnalisation des couleurs",
      "1 live simultané",
      "Support par email",
    ],
    priceEnv: {
      monthly: "STRIPE_PRICE_STARTER_MONTHLY",
      quarterly: "STRIPE_PRICE_STARTER_QUARTERLY",
      yearly: "STRIPE_PRICE_STARTER_YEARLY",
    },
  },
  {
    id: "creator",
    name: "Creator",
    description: "Pour les streamers réguliers qui veulent tout débloquer.",
    popular: true,
    monthlyPrice: 19,
    features: [
      "Tous les jeux + nouveautés",
      "Personnalisation avancée + logo",
      "3 lives simultanés",
      "Support prioritaire",
    ],
    priceEnv: {
      monthly: "STRIPE_PRICE_CREATOR_MONTHLY",
      quarterly: "STRIPE_PRICE_CREATOR_QUARTERLY",
      yearly: "STRIPE_PRICE_CREATOR_YEARLY",
    },
  },
  {
    id: "pro",
    name: "Pro",
    description: "Pour les gros comptes et les agences multi-créateurs.",
    monthlyPrice: 39,
    features: [
      "Tout Creator, sans limites",
      "Lives illimités & multi-comptes",
      "Jeux sur-mesure sur demande",
      "Accompagnement dédié",
    ],
    priceEnv: {
      monthly: "STRIPE_PRICE_PRO_MONTHLY",
      quarterly: "STRIPE_PRICE_PRO_QUARTERLY",
      yearly: "STRIPE_PRICE_PRO_YEARLY",
    },
  },
];

export function getPlan(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

// Résout l'ID de prix Stripe pour une offre + période donnée.
export function resolveStripePriceId(
  planId: PlanId,
  interval: BillingInterval,
): string | undefined {
  const plan = getPlan(planId);
  if (!plan) return undefined;
  const envKey = plan.priceEnv[interval];
  return process.env[envKey];
}

// Prix affiché (arrondi) selon la période, en euros/mois.
export function displayMonthlyPrice(
  plan: Plan,
  interval: BillingInterval,
): number {
  const discounted = plan.monthlyPrice * (1 - BILLING_DISCOUNT[interval]);
  return Math.round(discounted);
}
