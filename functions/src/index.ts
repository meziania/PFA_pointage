import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { defineString } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";

initializeApp();
setGlobalOptions({ region: "europe-west1", maxInstances: 10 });

const db = getFirestore();

const orgLat = defineString("ORG_LAT");
const orgLon = defineString("ORG_LON");
const orgRadiusM = defineString("ORG_RADIUS_M");
const qrToken = defineString("POINTAGE_QR_TOKEN");

type PointageType = "entree" | "sortie";

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

function extractQrToken(input: string): string {
  const raw = input.trim();
  if (!raw) return "";

  // Accept either a plain token or a "real link" containing ?token=...
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const u = new URL(raw);
      const token = u.searchParams.get("token") ?? u.searchParams.get("qr") ?? u.searchParams.get("t");
      if (token) return token.trim();
    } catch {
      // ignore URL parsing errors, fallback to raw
    }
  }

  return raw;
}

async function getUserRole(uid: string): Promise<"admin" | "employe" | null> {
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return null;
  const role = (snap.data() as { role?: unknown } | undefined)?.role;
  if (role === "admin" || role === "employe") return role;
  return null;
}

async function inferNextType(uid: string, ymd: string): Promise<PointageType> {
  const snap = await db
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

export const createPointage = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const uid = request.auth.uid;
  const role = await getUserRole(uid);
  if (role !== "employe") {
    throw new HttpsError("permission-denied", "Only employees can clock in/out via this function");
  }

  const data = (request.data ?? {}) as {
    latitude?: unknown;
    longitude?: unknown;
    qr?: unknown;
  };

  const lat = typeof data.latitude === "number" ? data.latitude : null;
  const lon = typeof data.longitude === "number" ? data.longitude : null;
  const qr = typeof data.qr === "string" ? data.qr.trim() : "";

  if (lat === null || lon === null || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new HttpsError("invalid-argument", "latitude/longitude are required");
  }

  const expectedQr = qrToken.value();
  if (!expectedQr) {
    throw new HttpsError("failed-precondition", "POINTAGE_QR_TOKEN is not configured on the function");
  }
  const provided = extractQrToken(qr);
  if (provided !== expectedQr) {
    throw new HttpsError("permission-denied", "Invalid QR token");
  }

  const orgLatRaw = orgLat.value().trim();
  const orgLonRaw = orgLon.value().trim();
  const orgRadiusRaw = orgRadiusM.value().trim();

  if (!orgLatRaw || !orgLonRaw || !orgRadiusRaw) {
    throw new HttpsError("failed-precondition", "ORG_LAT/ORG_LON/ORG_RADIUS_M must be configured on the function");
  }

  const centerLat = Number(orgLatRaw);
  const centerLon = Number(orgLonRaw);
  const radiusM = Number(orgRadiusRaw);
  if (!Number.isFinite(centerLat) || !Number.isFinite(centerLon) || !Number.isFinite(radiusM) || radiusM <= 0) {
    throw new HttpsError("failed-precondition", "ORG_LAT/ORG_LON/ORG_RADIUS_M are invalid");
  }

  const distance = haversineMeters(centerLat, centerLon, lat, lon);
  if (distance > radiusM) {
    throw new HttpsError("permission-denied", `Outside allowed area (${Math.round(distance)}m > ${Math.round(radiusM)}m)`);
  }

  const now = new Date();
  const ymd = toYMD(now);
  const hm = toHM(now);
  const type = await inferNextType(uid, ymd);

  const ref = await db.collection("pointages").add({
    userId: uid,
    date: ymd,
    heure: hm,
    type,
    latitude: lat,
    longitude: lon,
    valide: true,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { id: ref.id, date: ymd, heure: hm, type };
});
