import { NextResponse } from "next/server";

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
  const code = (error as { code?: string })?.code;
  if (code === "app/invalid-credential") return true;
  if (!(error instanceof Error)) return false;
  const msg = error.message;
  if (msg.includes("Failed to parse private key")) return true;
  return (
    msg.includes("FIREBASE_SERVICE_ACCOUNT_KEY") ||
    msg.includes("Firebase Admin non configuré") ||
    msg.includes("serviceAccountKey.json") ||
    msg.includes("clé de service")
  );
}

const FIREBASE_ADMIN_SETUP_HINT =
  "Configuration serveur incomplète. Placez serviceAccountKey.json à la racine du projet (ou ajoutez FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY sur Vercel), puis redémarrez.";

function isFirestoreIndexError(error: unknown): boolean {
  const code = (error as { code?: number | string })?.code;
  return code === 9 || code === "failed-precondition" || code === "FAILED_PRECONDITION";
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error && typeof error === "object" && "issues" in error) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }
  if (isFirestoreIndexError(error)) {
    return NextResponse.json(
      { error: "Index Firestore manquant. Exécutez : firebase deploy --only firestore:indexes" },
      { status: 503 },
    );
  }
  if (isFirebaseAdminConfigError(error)) {
    return NextResponse.json({ error: FIREBASE_ADMIN_SETUP_HINT }, { status: 503 });
  }
  console.error(error);
  return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
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
