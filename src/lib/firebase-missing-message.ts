/** Message affiché quand les variables Firebase Web ne sont pas disponibles (client). */
export function firebaseMissingConfigMessage(): string {
  if (process.env.NODE_ENV === "development") {
    return "Firebase n'est pas configuré. Vérifiez .env.local : NEXT_PUBLIC_FIREBASE_API_KEY, AUTH_DOMAIN, PROJECT_ID et APP_ID sont requis.";
  }
  return "Firebase n'est pas configuré sur ce déploiement. Dans Vercel → Settings → Environment Variables, ajoutez les variables NEXT_PUBLIC_FIREBASE_* pour Production, puis déclenchez un nouveau déploiement (Redeploy). Les variables « NEXT_PUBLIC » sont prises en compte au moment du build.";
}
