import { auth } from "@/auth";
import { isStaff } from "@/lib/rbac";
import { studioIdentity, type StudioIdentity } from "@/lib/studioAuth";

export const LOCK_TTL_MS = 90_000; // verrou sans heartbeat depuis 90 s = périmé.
export const MAX_VERSIONS = 40; // historique conservé par niveau.

// Résout l'appelant : app de bureau (jeton/clé) OU session web (staff).
export async function caller(req: Request): Promise<StudioIdentity | null> {
  const s = await studioIdentity(req);
  if (s) return s;
  const session = await auth();
  if (session?.user?.id && isStaff(session.user.role)) {
    return { id: session.user.id, role: session.user.role, name: session.user.name ?? "Staff" };
  }
  return null;
}

export function lockActive(lockedAt: Date | null): boolean {
  return !!lockedAt && Date.now() - new Date(lockedAt).getTime() < LOCK_TTL_MS;
}

export function lockInfo(l: { lockedByName: string | null; lockedById: string | null; lockedAt: Date | null }) {
  if (lockActive(l.lockedAt)) return { editingBy: l.lockedByName, editingById: l.lockedById };
  return { editingBy: null, editingById: null };
}
