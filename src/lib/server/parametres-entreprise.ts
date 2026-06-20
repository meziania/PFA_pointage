import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { ApiError } from "@/lib/server/api-auth";
import type { ParametresEntrepriseDoc } from "@/lib/data-model";

const DOC_ID = "default";

export async function getParametresEntreprise(): Promise<(ParametresEntrepriseDoc & { id: string }) | null> {
  const snap = await getAdminDb().collection("parametres_entreprise").doc(DOC_ID).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as ParametresEntrepriseDoc) };
}

export async function upsertParametresEntreprise(params: {
  latitude: number;
  longitude: number;
  rayon_metres: number;
  adminUid: string;
}): Promise<ParametresEntrepriseDoc & { id: string }> {
  const { latitude, longitude, rayon_metres, adminUid } = params;

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw ApiError.badRequest("Latitude invalide");
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw ApiError.badRequest("Longitude invalide");
  }
  if (!Number.isFinite(rayon_metres) || rayon_metres <= 0) {
    throw ApiError.badRequest("Rayon invalide");
  }

  const payload: ParametresEntrepriseDoc = {
    latitude,
    longitude,
    rayon_metres,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: adminUid,
  };

  await getAdminDb().collection("parametres_entreprise").doc(DOC_ID).set(payload, { merge: true });
  const saved = await getParametresEntreprise();
  if (!saved) throw ApiError.server("Impossible de lire les paramètres enregistrés");
  return saved;
}

export async function getGeofenceSettings(): Promise<{ latitude: number; longitude: number; radiusM: number } | null> {
  const params = await getParametresEntreprise();
  if (params) {
    return {
      latitude: params.latitude,
      longitude: params.longitude,
      radiusM: params.rayon_metres,
    };
  }

  const orgLat = process.env.ORG_LAT ?? process.env.NEXT_PUBLIC_ORG_LAT;
  const orgLon = process.env.ORG_LON ?? process.env.NEXT_PUBLIC_ORG_LON;
  const orgRadius = process.env.ORG_RADIUS_M ?? process.env.NEXT_PUBLIC_ORG_RADIUS_M;
  if (!orgLat || !orgLon || !orgRadius) return null;

  const latitude = Number(orgLat);
  const longitude = Number(orgLon);
  const radiusM = Number(orgRadius);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(radiusM) || radiusM <= 0) {
    return null;
  }

  return { latitude, longitude, radiusM };
}
