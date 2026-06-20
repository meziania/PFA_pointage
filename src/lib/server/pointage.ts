import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { ApiError } from "@/lib/server/api-auth";
import { getGeofenceSettings } from "@/lib/server/parametres-entreprise";
import { validatePointageQr } from "@/lib/server/qr-settings";
import type { PointageType } from "@/lib/data-model";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toYMD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toHM(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

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
    .limit(50)
    .get();

  if (snap.empty) return "entree";

  let latest: { createdAtMs: number; type: PointageType } | null = null;
  for (const doc of snap.docs) {
    const data = doc.data() as {
      type?: unknown;
      createdAt?: { toMillis?: () => number } | null;
      heure?: unknown;
    };
    const type = data.type === "sortie" || data.type === "entree" ? (data.type as PointageType) : null;
    if (!type) continue;
    const createdAtMs = typeof data.createdAt?.toMillis === "function" ? data.createdAt.toMillis() : -1;
    const heure = typeof data.heure === "string" ? data.heure : "00:00";
    const fallbackMs = Date.parse(`${ymd}T${heure}:00`);
    const ms = createdAtMs >= 0 ? createdAtMs : Number.isFinite(fallbackMs) ? fallbackMs : 0;
    if (!latest || ms >= latest.createdAtMs) latest = { createdAtMs: ms, type };
  }

  if (!latest) return "entree";
  return latest.type === "entree" ? "sortie" : "entree";
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
  const ymd = toYMD(now);
  const hm = toHM(now);
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

  return { id: ref.id, date: ymd, heure: hm, type };
}
