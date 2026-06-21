import { getFirebaseAuth } from "@/lib/firebase-auth";

export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const auth = getFirebaseAuth();
  const user = auth?.currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  if (init.auth !== false) {
    const token = await getIdToken();
    if (!token) {
      throw new Error("Authentification requise. Reconnectez-vous.");
    }
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(path, { ...init, headers });
  const contentType = res.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json")
    ? ((await res.json().catch(() => ({}))) as T & { error?: string })
    : ({} as T & { error?: string });

  if (!res.ok) {
    if (data.error) throw new Error(data.error);
    if (res.status === 503) {
      throw new Error(
        "Configuration serveur incomplète. Ajoutez serviceAccountKey.json (local) ou FIREBASE_SERVICE_ACCOUNT_KEY (Vercel).",
      );
    }
    if (!contentType.includes("application/json")) {
      throw new Error(
        `Erreur serveur (${res.status}). Vérifiez FIREBASE_SERVICE_ACCOUNT_KEY sur Vercel et redéployez.`,
      );
    }
    throw new Error(`Erreur HTTP ${res.status}`);
  }

  return data;
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
