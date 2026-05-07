import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { auth } from "firebase-functions/v1";
import { defineString } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import crypto from "node:crypto";

initializeApp();
setGlobalOptions({ region: "europe-west1", maxInstances: 10 });

const db = getFirestore();

const orgLat = defineString("ORG_LAT");
const orgLon = defineString("ORG_LON");
const orgRadiusM = defineString("ORG_RADIUS_M");
const qrToken = defineString("POINTAGE_QR_TOKEN");

type PointageType = "entree" | "sortie";

export const onAuthUserCreated = auth.user().onCreate(async (user) => {
  if (!user?.uid) return;

  const uid = user.uid;
  const email = user.email ?? "";
  const nom = user.displayName ?? (email ? email.split("@")[0] : "Employé");

  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();
  if (snap.exists) return;

  await ref.set({
    nom,
    email,
    role: "employe",
    createdAt: FieldValue.serverTimestamp(),
  });
});

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

type PointageSettings = {
  qrToken?: unknown;
  qrTokenHash?: unknown;
  qrTokenVersion?: unknown;
  qrExpiresAt?: { toMillis?: () => number } | null;
  allowPreviousHashUntil?: { toMillis?: () => number } | null;
  previousQrTokenHash?: unknown;
};

type NotificationDoc = {
  userId: string;
  title: string;
  body: string;
  qrLink?: string;
  createdAt: unknown;
  read: boolean;
};

function randomTokenBase64Url(bytes = 32): string {
  return crypto
    .randomBytes(bytes)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

async function getCurrentQrToken(): Promise<{ token: string; expiresAtMs?: number | null; source: "firestore" | "env" }> {
  // Prefer Firestore so the token can be rotated without redeploying functions.
  const snap = await db.collection("settings").doc("pointage").get();
  if (snap.exists) {
    const data = snap.data() as PointageSettings;
    const expiresAtMs = typeof data.qrExpiresAt?.toMillis === "function" ? data.qrExpiresAt.toMillis() : null;
    const tokenHash = typeof data.qrTokenHash === "string" ? data.qrTokenHash.trim() : "";
    // Backward compatibility: older doc might have qrToken in clear.
    const tokenClear = typeof data.qrToken === "string" ? data.qrToken.trim() : "";
    if (tokenHash) return { token: tokenHash, expiresAtMs, source: "firestore" };
    if (tokenClear) return { token: tokenClear, expiresAtMs, source: "firestore" };
  }

  const token = qrToken.value().trim();
  if (!token) {
    throw new HttpsError("failed-precondition", "POINTAGE_QR_TOKEN is not configured on the function");
  }
  return { token, expiresAtMs: null, source: "env" };
}

export const rotatePointageQrWeekly = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");
  const uid = request.auth.uid;
  const role = await getUserRole(uid);
  if (role !== "admin") throw new HttpsError("permission-denied", "Only admins can rotate the QR token");

  const now = Date.now();
  const expiresAtMs = now + 7 * 24 * 60 * 60 * 1000;
  const token = randomTokenBase64Url(24);
  const tokenHash = sha256Hex(token);

  const ref = db.collection("settings").doc("pointage");
  const prevSnap = await ref.get();
  const prev = prevSnap.exists ? (prevSnap.data() as PointageSettings) : null;
  const previousHash = typeof prev?.qrTokenHash === "string" ? prev.qrTokenHash.trim() : "";
  const previousClear = typeof prev?.qrToken === "string" ? prev.qrToken.trim() : "";
  const previousToStore = previousHash || (previousClear ? sha256Hex(previousClear) : "");
  const graceUntilMs = now + 24 * 60 * 60 * 1000; // 24h grace for old QR

  await ref.set(
    {
      // Store only hash going forward (token itself returned to admin caller)
      qrTokenHash: tokenHash,
      qrTokenVersion: FieldValue.increment(1),
      previousQrTokenHash: previousToStore || FieldValue.delete(),
      allowPreviousHashUntil: previousToStore ? new Date(graceUntilMs) : FieldValue.delete(),
      qrExpiresAt: new Date(expiresAtMs),
      updatedAt: FieldValue.serverTimestamp(),
      // Keep legacy field empty to avoid leaking token via Firestore reads
      qrToken: FieldValue.delete(),
    },
    { merge: true },
  );

  return { token, expiresAtMs };
});

export const scheduledRotatePointageQrWeekly = onSchedule("every monday 08:00", async () => {
  // Weekly rotation without manual admin action.
  const now = Date.now();
  const expiresAtMs = now + 7 * 24 * 60 * 60 * 1000;
  const token = randomTokenBase64Url(24);
  const tokenHash = sha256Hex(token);

  const ref = db.collection("settings").doc("pointage");
  const prevSnap = await ref.get();
  const prev = prevSnap.exists ? (prevSnap.data() as PointageSettings) : null;
  const previousHash = typeof prev?.qrTokenHash === "string" ? prev.qrTokenHash.trim() : "";
  const previousToStore = previousHash || "";
  const graceUntilMs = now + 24 * 60 * 60 * 1000; // 24h grace for old QR

  await ref.set(
    {
      qrTokenHash: tokenHash,
      qrTokenVersion: FieldValue.increment(1),
      previousQrTokenHash: previousToStore || FieldValue.delete(),
      allowPreviousHashUntil: previousToStore ? new Date(graceUntilMs) : FieldValue.delete(),
      qrExpiresAt: new Date(expiresAtMs),
      updatedAt: FieldValue.serverTimestamp(),
      qrToken: FieldValue.delete(),
    },
    { merge: true },
  );

  // For security, we do NOT store/return the raw token here. The admin UI should rotate manually to distribute.
  // If you want automatic distribution, wire email/in-app notifications here (and use a one-time token encryption).
});

export const notifyEmployeesNewQr = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");
  const uid = request.auth.uid;
  const role = await getUserRole(uid);
  if (role !== "admin") throw new HttpsError("permission-denied", "Only admins can notify employees");

  const data = (request.data ?? {}) as { link?: unknown; tokenExpiresAtMs?: unknown };
  const link = typeof data.link === "string" ? data.link.trim() : "";
  const expMs = typeof data.tokenExpiresAtMs === "number" ? data.tokenExpiresAtMs : null;

  const usersSnap = await db.collection("users").where("role", "==", "employe").limit(1000).get();
  if (usersSnap.empty) return { sent: 0 };

  const batch = db.batch();
  let sent = 0;
  const expiryHint = expMs ? `Valable jusqu’au ${new Date(expMs).toLocaleString("fr-FR")}.` : "";
  const body = `Un nouveau QR de pointage est disponible. ${expiryHint}`.trim();

  for (const u of usersSnap.docs) {
    const userId = u.id;
    const ref = db.collection("notifications").doc();
    const docData: NotificationDoc = {
      userId,
      title: "Nouveau QR de pointage",
      body,
      ...(link ? { qrLink: link } : {}),
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    };
    batch.set(ref, docData);
    sent += 1;
  }

  await batch.commit();
  return { sent };
});

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

  const provided = extractQrToken(qr);
  const { token: expected, expiresAtMs } = await getCurrentQrToken();

  const providedHash = sha256Hex(provided);
  const expectedLooksHashed = expected.length === 64 && /^[0-9a-f]{64}$/i.test(expected);

  if (expectedLooksHashed) {
    // Hash-based validation (preferred)
    if (providedHash !== expected) {
      // Check grace period for previous hash
      const snap = await db.collection("settings").doc("pointage").get();
      const data = snap.exists ? (snap.data() as PointageSettings) : null;
      const prevHash = typeof data?.previousQrTokenHash === "string" ? data.previousQrTokenHash.trim() : "";
      const prevUntil = typeof data?.allowPreviousHashUntil?.toMillis === "function" ? data.allowPreviousHashUntil.toMillis() : null;
      const prevOk = Boolean(prevHash && prevUntil && Date.now() <= prevUntil && providedHash === prevHash);
      if (!prevOk) throw new HttpsError("permission-denied", "Invalid QR token");
    }
  } else {
    // Legacy clear-text validation (env or old doc)
    if (provided !== expected) throw new HttpsError("permission-denied", "Invalid QR token");
  }

  if (typeof expiresAtMs === "number" && Number.isFinite(expiresAtMs) && Date.now() > expiresAtMs) {
    throw new HttpsError("permission-denied", "QR token expired");
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
