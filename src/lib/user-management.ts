import { apiFetch, apiErrorMessage } from "@/lib/api-client";

export { apiErrorMessage };

export async function submitDemandeAcces(params: {
  nom: string;
  email: string;
  telephone?: string;
  message?: string;
}): Promise<{ id: string }> {
  return apiFetch("/api/demandes-acces", {
    method: "POST",
    auth: false,
    body: JSON.stringify(params),
  });
}

export async function listDemandesAcces(params?: { statut?: "en_attente" | "approuvee" | "refusee" }) {
  const query = params?.statut ? `?statut=${params.statut}` : "";
  return apiFetch<{ demandes: Array<Record<string, unknown> & { id: string }> }>(`/api/demandes-acces${query}`);
}

export async function approuverDemandeAcces(requestId: string) {
  return apiFetch<{
    statut: string;
    uid: string;
    email: string;
    temporaryPassword: string;
    emailSent: boolean;
    loginUrl: string;
  }>(`/api/demandes-acces/${requestId}/approuver`, { method: "PUT" });
}

export async function refuserDemandeAcces(requestId: string) {
  return apiFetch<{ statut: string }>(`/api/demandes-acces/${requestId}/refuser`, { method: "PUT" });
}

export async function supprimerDemandeAcces(requestId: string) {
  return apiFetch<{ ok: boolean }>(`/api/demandes-acces/${requestId}`, { method: "DELETE" });
}

export async function createEmployeeAccount(params: {
  nom: string;
  email: string;
  password: string;
  matricule?: string;
  departement?: string;
  poste?: string;
  telephone?: string;
}) {
  return apiFetch<{ uid: string; email: string }>("/api/employees", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function desactiverEmploye(userId: string) {
  return apiFetch<{ statut: string }>(`/api/employees/${userId}/desactiver`, { method: "PUT" });
}

export async function reactiverEmploye(userId: string) {
  return apiFetch<{ statut: string }>(`/api/employees/${userId}/reactiver`, { method: "PUT" });
}

export async function supprimerEmploye(userId: string) {
  return apiFetch<{ ok: boolean }>(`/api/employees/${userId}`, { method: "DELETE" });
}

export async function updateEmploye(
  userId: string,
  patch: {
    nom?: string;
    email?: string;
    matricule?: string;
    departement?: string;
    poste?: string;
    telephone?: string;
    cin?: string;
    adresse?: string;
    dateNaissance?: string;
    dateEmbauche?: string;
  },
) {
  return apiFetch<{ employe: Record<string, unknown> & { id: string } }>(`/api/employees/${userId}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export async function getGeofenceZone() {
  return apiFetch<{
    geofence: { latitude: number; longitude: number; rayon_metres: number } | null;
  }>("/api/geofence");
}

export async function getParametresEntreprise() {
  return apiFetch<{ parametres: Record<string, unknown> | null }>("/api/parametres-entreprise");
}

export async function updateParametresEntreprise(params: {
  latitude: number;
  longitude: number;
  rayon_metres: number;
}) {
  return apiFetch<{ parametres: Record<string, unknown> }>("/api/parametres-entreprise", {
    method: "PUT",
    body: JSON.stringify(params),
  });
}

export async function createPointage(params: { latitude: number; longitude: number; qr: string }) {
  return apiFetch<{ id: string; date: string; heure: string; type: string }>("/api/pointage", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function changePassword(newPassword: string) {
  return apiFetch<{ ok: boolean }>("/api/auth/change-password", {
    method: "PUT",
    body: JSON.stringify({ newPassword }),
  });
}

export type DynamicQrPayload = {
  mode: "dynamic";
  token: string;
  qrLink: string;
  windowMs: number;
  windowEndsAtMs: number;
  secondsRemaining: number;
};

export async function getCurrentQr(): Promise<DynamicQrPayload> {
  return apiFetch<DynamicQrPayload>("/api/qr/current");
}

export async function initDynamicQr(): Promise<{ mode: string; initialized: boolean }> {
  return apiFetch<{ mode: string; initialized: boolean }>("/api/qr/init", { method: "POST" });
}
