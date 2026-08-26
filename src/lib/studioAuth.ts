// Identifie l'appelant d'une route "studio/app de bureau" :
//  - soit via un jeton compte (Authorization: Bearer <token>)
//  - soit via la clé partagée héritée (x-studio-key) → traitée comme admin.
import { verifyStudioToken } from "@/lib/studioToken";

export interface StudioIdentity {
  id: string | null;
  role: string;
  name: string;
  email?: string;
}

export async function studioIdentity(req: Request): Promise<StudioIdentity | null> {
  const authz = req.headers.get("authorization");
  if (authz && authz.startsWith("Bearer ")) {
    const claims = await verifyStudioToken(authz.slice(7).trim());
    if (claims) return { id: claims.sub, role: claims.role, name: claims.name, email: claims.email };
  }
  const key = process.env.STUDIO_API_KEY;
  if (key && req.headers.get("x-studio-key") === key) {
    return { id: null, role: "admin", name: "Studio (clé)" };
  }
  return null;
}
