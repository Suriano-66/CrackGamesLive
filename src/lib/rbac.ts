import { redirect } from "next/navigation";
import { auth } from "@/auth";

// Contrôle d'accès basé sur les rôles (RBAC).

export type Role = "user" | "support" | "admin";

export const ROLE_LABELS: Record<string, string> = {
  user: "Membre",
  support: "Support",
  admin: "Admin",
};

export const STAFF_ROLES: Role[] = ["admin", "support"];

export function isStaff(role?: string | null): boolean {
  return !!role && (STAFF_ROLES as string[]).includes(role);
}

export function isAdmin(role?: string | null): boolean {
  return role === "admin";
}

// À utiliser dans un Server Component / Route Handler.
// Renvoie la session ou redirige si l'accès est refusé.
export async function requireStaff() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!isStaff(session.user.role)) redirect("/dashboard");
  return session;
}

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!isAdmin(session.user.role)) redirect("/dashboard");
  return session;
}
