import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApps, initializeApp, type App, type ServiceAccount } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, initializeFirestore, type Firestore } from "firebase-admin/firestore";

let app: App | undefined;
let authAdmin: Auth | undefined;
let dbAdmin: Firestore | undefined;

export const ADMIN_CONFIG_MESSAGE =
  "Firebase Admin non configuré. Placez serviceAccountKey.json à la racine du projet (ou définissez FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY dans .env.local), puis redémarrez npm run dev.";

type ServiceAccountJson = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function normalizePrivateKey(raw: string): string {
  return raw.replace(/\\n/g, "\n");
}

function loadServiceAccountFromSplitEnv(): ServiceAccountJson | null {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY?.trim();
  const projectId =
    process.env.FIREBASE_PROJECT_ID?.trim() || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();

  if (!clientEmail || !privateKeyRaw || !projectId) return null;

  return {
    project_id: projectId,
    client_email: clientEmail,
    private_key: normalizePrivateKey(privateKeyRaw),
  };
}

function loadServiceAccountFromEnv(): ServiceAccountJson | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccountJson;
    if (parsed.private_key) parsed.private_key = normalizePrivateKey(parsed.private_key);
    return parsed;
  } catch {
    throw new Error("Firebase Admin: FIREBASE_SERVICE_ACCOUNT_KEY contient un JSON invalide");
  }
}

function loadServiceAccountFromFile(): ServiceAccountJson | null {
  if (process.env.VERCEL) return null;

  const configured = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  const candidates = [
    configured ? resolve(process.cwd(), configured) : null,
    resolve(process.cwd(), "serviceAccountKey.json"),
    resolve(process.cwd(), "secrets", "serviceAccountKey.json"),
  ].filter(Boolean) as string[];

  for (const filePath of candidates) {
    try {
      const raw = readFileSync(filePath, "utf8");
      return JSON.parse(raw) as ServiceAccountJson;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") continue;
      throw new Error(`Firebase Admin: impossible de lire ${filePath}`);
    }
  }
  return null;
}

function loadServiceAccount(): ServiceAccountJson {
  const serviceAccount =
    loadServiceAccountFromSplitEnv() ?? loadServiceAccountFromEnv() ?? loadServiceAccountFromFile();
  if (!serviceAccount) {
    throw new Error(ADMIN_CONFIG_MESSAGE);
  }
  if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error("Firebase Admin: clé de service incomplète (project_id, client_email, private_key)");
  }
  return serviceAccount;
}

export function hasAdminCredentials(): boolean {
  if (loadServiceAccountFromSplitEnv()) return true;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim()) return true;
  if (process.env.VERCEL) return false;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim()) return true;
  return (
    existsSync(resolve(process.cwd(), "serviceAccountKey.json")) ||
    existsSync(resolve(process.cwd(), "secrets", "serviceAccountKey.json"))
  );
}

export function assertAdminConfigured(): void {
  if (!hasAdminCredentials()) {
    throw new Error(ADMIN_CONFIG_MESSAGE);
  }
}

function initAdminApp(): App {
  if (getApps().length) return getApps()[0]!;

  const serviceAccount = loadServiceAccount();

  const initialized = initializeApp({
    credential: cert(serviceAccount as ServiceAccount),
    projectId: serviceAccount.project_id,
    ...(process.env.FIREBASE_DATABASE_URL?.trim()
      ? { databaseURL: process.env.FIREBASE_DATABASE_URL.trim() }
      : {}),
  });

  try {
    initializeFirestore(initialized, { preferRest: true });
  } catch {
    // hot reload
  }

  return initialized;
}

export function getAdminApp(): App {
  if (!app) app = initAdminApp();
  return app;
}

export function getAdminAuth(): Auth {
  if (!authAdmin) authAdmin = getAuth(getAdminApp());
  return authAdmin;
}

export function getAdminDb(): Firestore {
  if (!dbAdmin) dbAdmin = getFirestore(getAdminApp());
  return dbAdmin;
}
