import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/server/firebase-admin";
import type { UserDoc, UserRole, UserStatut } from "@/lib/data-model";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }

  static badRequest(message: string) {
    return new ApiError(400, message);
  }

  static unauthorized(message = "Authentification requise") {
    return new ApiError(401, message);
  }

  static forbidden(message = "Accès refusé") {
    return new ApiError(403, message);
  }

  static notFound(message = "Ressource introuvable") {
    return new ApiError(404, message);
  }

  static conflict(message: string) {
    return new ApiError(409, message);
  }

  static server(message = "Erreur serveur") {
    return new ApiError(500, message);
  }
}

function isFirebaseAdminConfigError(error: unknown): boolean {
  if (error instanceof Error && error.message.includes("FIREBASE_SERVICE_ACCOUNT_KEY")) return true;
  const code = (error as { code?: string })?.code;
  return code === "app/invalid-credential";
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error && typeof error === "object" && "issues" in error) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }
  if (isFirebaseAdminConfigError(error)) {
    return NextResponse.json(
      {
        error:
          "Configuration serveur incomplète. Ajoutez FIREBASE_SERVICE_ACCOUNT_KEY dans .env.local (Firebase Console → Paramètres → Comptes de service → Générer une nouvelle clé privée), puis redémarrez npm run dev.",
      },
      { status: 503 },
    );
  }
  console.error(error);
  return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
}

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

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim() || "http://localhost:3000";
}
