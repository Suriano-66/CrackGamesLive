// Jetons pour les applications de bureau (Studio éditeur, app Streamer).
// L'utilisateur se connecte avec son compte du site ; on lui délivre un JWT
// signé (HS256) avec AUTH_SECRET, que l'app stocke et renvoie à chaque appel.
import { SignJWT, jwtVerify } from "jose";

export interface StudioClaims {
  sub: string; // userId
  role: string; // user | support | admin
  name: string;
  email: string;
}

function secret() {
  const s = process.env.AUTH_SECRET || "dev-secret-change-me";
  return new TextEncoder().encode(s);
}

export async function signStudioToken(claims: StudioClaims): Promise<string> {
  return new SignJWT({ role: claims.role, name: claims.name, email: claims.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

export async function verifyStudioToken(token: string): Promise<StudioClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    return {
      sub: String(payload.sub),
      role: String(payload.role ?? "user"),
      name: String(payload.name ?? ""),
      email: String(payload.email ?? ""),
    };
  } catch {
    return null;
  }
}
