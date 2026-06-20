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
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };

  if (!res.ok) {
    throw new Error(data.error ?? `Erreur HTTP ${res.status}`);
  }

  return data;
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
