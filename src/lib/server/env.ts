import { existsSync } from "node:fs";
import { resolve } from "node:path";

export type ServerEnvStatus = {
  firebaseClient: boolean;
  firebaseAdmin: boolean;
  qrSecret: boolean;
  geofenceFallback: boolean;
  smtp: boolean;
  appUrl: string;
  warnings: string[];
};

function detectAdminCredentials(): boolean {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim()) return true;
  if (
    process.env.FIREBASE_CLIENT_EMAIL?.trim() &&
    process.env.FIREBASE_PRIVATE_KEY?.trim() &&
    (process.env.FIREBASE_PROJECT_ID?.trim() || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim())
  ) {
    return true;
  }
  if (process.env.VERCEL) return false;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim()) return true;
  return (
    existsSync(resolve(process.cwd(), "serviceAccountKey.json")) ||
    existsSync(resolve(process.cwd(), "secrets", "serviceAccountKey.json"))
  );
}

export function getServerEnvStatus(): ServerEnvStatus {
  const warnings: string[] = [];

  const firebaseClient = Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim());
  if (!firebaseClient) warnings.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID manquant — client Firebase indisponible");

  const firebaseAdmin = detectAdminCredentials();
  if (!firebaseAdmin) {
    warnings.push(
      "Firebase Admin manquant — serviceAccountKey.json (local) ou FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY (Vercel)",
    );
  }

  const qrSecret = Boolean(process.env.POINTAGE_QR_SECRET?.trim());
  const geofenceFallback = Boolean(
    (process.env.ORG_LAT ?? process.env.NEXT_PUBLIC_ORG_LAT)?.trim() &&
      (process.env.ORG_LON ?? process.env.NEXT_PUBLIC_ORG_LON)?.trim() &&
      (process.env.ORG_RADIUS_M ?? process.env.NEXT_PUBLIC_ORG_RADIUS_M)?.trim(),
  );

  const smtp = Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim());
  const resend = Boolean(process.env.RESEND_API_KEY?.trim());
  if (!smtp && !resend) warnings.push("Email non configuré — ajoutez RESEND_API_KEY (recommandé) ou SMTP");

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim() || "http://localhost:3000";

  return {
    firebaseClient,
    firebaseAdmin,
    qrSecret,
    geofenceFallback,
    smtp: smtp || resend,
    appUrl,
    warnings,
  };
}
