export type ServerEnvStatus = {
  firebaseClient: boolean;
  firebaseAdmin: boolean;
  qrSecret: boolean;
  geofenceFallback: boolean;
  smtp: boolean;
  appUrl: string;
  warnings: string[];
};

export function getServerEnvStatus(): ServerEnvStatus {
  const warnings: string[] = [];

  const firebaseClient = Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim());
  if (!firebaseClient) warnings.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID manquant — client Firebase indisponible");

  const firebaseAdmin = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim());
  if (!firebaseAdmin) {
    warnings.push(
      "FIREBASE_SERVICE_ACCOUNT_KEY manquant — les routes API (verifyIdToken) échoueront hors environnement GCP",
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
