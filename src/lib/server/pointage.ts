import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { ApiError } from "@/lib/server/api-auth";
import { getGeofenceSettings } from "@/lib/server/parametres-entreprise";
import { validatePointageQr } from "@/lib/server/qr-settings";
import { getMoroccoNowParts } from "@/lib/pointage-time";
import type { PointageType } from "@/lib/data-model";

const MIN_SECONDS_BETWEEN_PUNCHES = 45;

function haversineMeters(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

async function inferNextType(uid: string, ymd: string): Promise<PointageType> {
  const snap = await getAdminDb()
    .collection("pointages")
    .where("userId", "==", uid)
    .where("date", "==", ymd)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();

  if (snap.empty) return "entree";

  const data = snap.docs[0]!.data() as { type?: unknown; createdAt?: { toMillis?: () => number } | null; heure?: unknown };
  const type = data.type === "sortie" || data.type === "entree" ? (data.type as PointageType) : null;

  const createdAtMs = typeof data.createdAt?.toMillis === "function" ? data.createdAt.toMillis() : -1;
  if (createdAtMs >= 0) {
    const elapsedSec = (Date.now() - createdAtMs) / 1000;
    if (elapsedSec < MIN_SECONDS_BETWEEN_PUNCHES) {
      throw ApiError.badRequest(`Attendez ${MIN_SECONDS_BETWEEN_PUNCHES}s entre deux pointages`);
    }
  }

  if (!type) return "entree";
  return type === "entree" ? "sortie" : "entree";
}

export async function createPointageRecord(params: {
  uid: string;
  latitude: number;
  longitude: number;
  qr: string;
}): Promise<{ id: string; date: string; heure: string; type: PointageType }> {
  const lat = params.latitude;
  const lon = params.longitude;
  const qr = params.qr.trim();

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw ApiError.badRequest("latitude/longitude requis");
  }

  try {
    await validatePointageQr(qr);
  } catch (err) {
    const message = err instanceof Error ? err.message : "QR invalide";
    if (message.includes("non configuré")) throw ApiError.server(message);
    throw ApiError.forbidden(message);
  }

  const geofence = await getGeofenceSettings();
  if (!geofence) throw ApiError.server("Paramètres entreprise (géolocalisation) non configurés");

  const distance = haversineMeters(geofence.latitude, geofence.longitude, lat, lon);
  if (distance > geofence.radiusM) {
    throw ApiError.forbidden(`Hors zone autorisée (${Math.round(distance)} m > ${Math.round(geofence.radiusM)} m)`);
  }

  const now = new Date();
  const { ymd, hm } = getMoroccoNowParts(now);
  const type = await inferNextType(params.uid, ymd);

  const ref = await getAdminDb().collection("pointages").add({
    userId: params.uid,
    date: ymd,
    heure: hm,
    type,
    latitude: lat,
    longitude: lon,
    valide: true,
    createdAt: FieldValue.serverTimestamp(),
  });

  const { refreshJournalPresenceForDay } = await import("@/lib/server/presence-journal");
  await refreshJournalPresenceForDay(params.uid, ymd);

  return { id: ref.id, date: ymd, heure: hm, type };
}
