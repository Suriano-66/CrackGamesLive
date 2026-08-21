// Statuts d'abonnement considérés comme "actifs" (accès aux jeux).
export const ACTIVE_STATUSES = ["active", "trialing"];

export function hasActiveAccess(status?: string | null): boolean {
  return !!status && ACTIVE_STATUSES.includes(status);
}
