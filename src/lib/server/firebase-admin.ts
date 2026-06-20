import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let app: App | undefined;
let authAdmin: Auth | undefined;
let dbAdmin: Firestore | undefined;

export const ADMIN_CONFIG_MESSAGE =
  "Firebase Admin non configuré. Placez serviceAccountKey.json à la racine du projet (ou définissez FIREBASE_SERVICE_ACCOUNT_PATH / FIREBASE_SERVICE_ACCOUNT_KEY dans .env.local), puis redémarrez npm run dev.";

type ServiceAccountJson = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function loadServiceAccountFromEnv(): ServiceAccountJson | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ServiceAccountJson;
  } catch {
    throw new Error("Firebase Admin: FIREBASE_SERVICE_ACCOUNT_KEY contient un JSON invalide");
  }
}

function loadServiceAccountFromFile(): ServiceAccountJson | null {
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
  const serviceAccount = loadServiceAccountFromEnv() ?? loadServiceAccountFromFile();
  if (!serviceAccount) {
    throw new Error(ADMIN_CONFIG_MESSAGE);
  }
  if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error("Firebase Admin: clé de service incomplète (project_id, client_email, private_key)");
  }
  return serviceAccount;
}

export function hasAdminCredentials(): boolean {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim()) return true;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim()) return true;
  try {
    readFileSync(resolve(process.cwd(), "serviceAccountKey.json"));
    return true;
  } catch {
    try {
      readFileSync(resolve(process.cwd(), "secrets", "serviceAccountKey.json"));
      return true;
    } catch {
      return false;
    }
  }
}

export function assertAdminConfigured(): void {
  if (!hasAdminCredentials()) {
    throw new Error(ADMIN_CONFIG_MESSAGE);
  }
}

function initAdminApp(): App {
  if (getApps().length) return getApps()[0]!;

  const serviceAccount = loadServiceAccount();

  return initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id,
    // Realtime Database — optionnel, uniquement si vous l'utilisez plus tard
    ...(process.env.FIREBASE_DATABASE_URL?.trim()
      ? { databaseURL: process.env.FIREBASE_DATABASE_URL.trim() }
      : {}),
  });
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
