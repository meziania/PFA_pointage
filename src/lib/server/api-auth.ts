import { getAdminAuth, getAdminDb } from "@/lib/server/firebase-admin";
import type { UserDoc, UserRole, UserStatut } from "@/lib/data-model";
import { ApiError } from "@/lib/server/api-errors";

export { ApiError, apiErrorResponse, normalizeEmail, isValidEmail, getAppUrl } from "@/lib/server/api-errors";

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

export async function getUserDocAdmin(uid: string): Promise<(UserDoc & { id: string }) | null> {
  const snap = await getAdminDb().collection("users").doc(uid).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as UserDoc) };
}

export async function requireAuth(request: Request): Promise<{ uid: string; user: UserDoc & { id: string } }> {
  const token = getBearerToken(request);
  if (!token) throw ApiError.unauthorized();

  let decoded;
  try {
    decoded = await getAdminAuth().verifyIdToken(token);
  } catch {
    throw ApiError.unauthorized("Token invalide ou expiré");
  }

  const user = await getUserDocAdmin(decoded.uid);
  if (!user) throw ApiError.forbidden("Profil utilisateur introuvable");

  const statut: UserStatut = user.statut ?? "actif";
  if (statut !== "actif") {
    throw ApiError.forbidden("Compte désactivé. Contactez l'administrateur.");
  }

  return { uid: decoded.uid, user };
}

export async function requireAdmin(request: Request): Promise<{ uid: string; user: UserDoc & { id: string } }> {
  const session = await requireAuth(request);
  if (session.user.role !== ("admin" satisfies UserRole)) {
    throw ApiError.forbidden("Action réservée à l'administrateur");
  }
  return session;
}

export async function requireEmploye(request: Request): Promise<{ uid: string; user: UserDoc & { id: string } }> {
  const session = await requireAuth(request);
  if (session.user.role !== ("employe" satisfies UserRole)) {
    throw ApiError.forbidden("Action réservée aux employés");
  }
  return session;
}
