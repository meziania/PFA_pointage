import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { defineString } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import * as logger from "firebase-functions/logger";
import crypto from "node:crypto";
import { validatePointageQrFromFirestore } from "./qr-dynamic";

initializeApp();
setGlobalOptions({ region: "europe-west1", maxInstances: 10 });

const db = getFirestore();
const authAdmin = getAuth();

const orgLat = defineString("ORG_LAT");
const orgLon = defineString("ORG_LON");
const orgRadiusM = defineString("ORG_RADIUS_M");
const qrToken = defineString("POINTAGE_QR_TOKEN");
const qrSecret = defineString("POINTAGE_QR_SECRET");

type PointageType = "entree" | "sortie";

// Profil Firestore `users/{uid}` : créé par l'admin (createEmployeeAccount / processJoinRequest).
// Pas de trigger Auth Gen1 : évite Gen1 + IAM bucket `gcf-sources-*` ; Auth n'a pas d'équivalent Gen2 « after create » sans Identity Platform.

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function assertAdmin(uid: string): Promise<void> {
  const role = await getUserRole(uid);
  if (role !== "admin") throw new HttpsError("permission-denied", "Only admins can perform this action");
}

async function emailAlreadyRegistered(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  try {
    await authAdmin.getUserByEmail(normalized);
    return true;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "auth/user-not-found") return false;
    throw err;
  }
}

async function createEmployeAccount(params: {
  nom: string;
  email: string;
  password: string;
  matricule?: string;
  departement?: string;
  poste?: string;
  telephone?: string;
  statut?: "actif" | "desactive";
  doit_changer_mdp?: boolean;
}): Promise<{ uid: string; email: string }> {
  const nom = params.nom.trim();
  const email = normalizeEmail(params.email);
  const password = params.password;

  if (nom.length < 2) throw new HttpsError("invalid-argument", "Le nom doit contenir au moins 2 caractères");
  if (!isValidEmail(email)) throw new HttpsError("invalid-argument", "Email invalide");
  if (typeof password !== "string" || password.length < 6) {
    throw new HttpsError("invalid-argument", "Le mot de passe doit contenir au moins 6 caractères");
  }

  if (await emailAlreadyRegistered(email)) {
    throw new HttpsError("already-exists", "Cet email est déjà utilisé");
  }

  const userRecord = await authAdmin.createUser({
    email,
    password,
    displayName: nom,
  });

  const userDoc: Record<string, unknown> = {
    nom,
    email,
    role: "employe",
    statut: params.statut ?? "actif",
    doit_changer_mdp: params.doit_changer_mdp ?? true,
    createdAt: FieldValue.serverTimestamp(),
  };

  const optional: Array<keyof Pick<typeof params, "matricule" | "departement" | "poste" | "telephone">> = [
    "matricule",
    "departement",
    "poste",
    "telephone",
  ];
  for (const key of optional) {
    const v = params[key];
    if (typeof v === "string" && v.trim()) userDoc[key] = v.trim();
  }

  await db.collection("users").doc(userRecord.uid).set(userDoc);
  return { uid: userRecord.uid, email };
}

export const submitJoinRequest = onCall(async (request) => {
  const data = (request.data ?? {}) as {
    nom?: unknown;
    email?: unknown;
    message?: unknown;
    departement?: unknown;
    poste?: unknown;
  };

  const nom = typeof data.nom === "string" ? data.nom.trim() : "";
  const email = typeof data.email === "string" ? normalizeEmail(data.email) : "";
  const message = typeof data.message === "string" ? data.message.trim() : "";
  const departement = typeof data.departement === "string" ? data.departement.trim() : "";
  const poste = typeof data.poste === "string" ? data.poste.trim() : "";

  if (nom.length < 2) throw new HttpsError("invalid-argument", "Le nom doit contenir au moins 2 caractères");
  if (!isValidEmail(email)) throw new HttpsError("invalid-argument", "Email invalide");

  if (await emailAlreadyRegistered(email)) {
    throw new HttpsError("already-exists", "Un compte existe déjà avec cet email. Connectez-vous.");
  }

  const pendingSnap = await db
    .collection("demandes_acces")
    .where("email", "==", email)
    .where("statut", "==", "en_attente")
    .limit(1)
    .get();

  if (!pendingSnap.empty) {
    throw new HttpsError("already-exists", "Une demande est déjà en attente pour cet email");
  }

  const docData: Record<string, unknown> = {
    nom,
    email,
    statut: "en_attente",
    date_demande: FieldValue.serverTimestamp(),
  };
  if (message) docData.message = message;
  if (departement) docData.departement = departement;
  if (poste) docData.poste = poste;

  const ref = await db.collection("demandes_acces").add(docData);
  return { id: ref.id };
});

export const createEmployeeAccount = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");
  await assertAdmin(request.auth.uid);

  const data = (request.data ?? {}) as {
    nom?: unknown;
    email?: unknown;
    password?: unknown;
    matricule?: unknown;
    departement?: unknown;
    poste?: unknown;
    telephone?: unknown;
  };

  const result = await createEmployeAccount({
    nom: typeof data.nom === "string" ? data.nom : "",
    email: typeof data.email === "string" ? data.email : "",
    password: typeof data.password === "string" ? data.password : "",
    matricule: typeof data.matricule === "string" ? data.matricule : undefined,
    departement: typeof data.departement === "string" ? data.departement : undefined,
    poste: typeof data.poste === "string" ? data.poste : undefined,
    telephone: typeof data.telephone === "string" ? data.telephone : undefined,
    statut: "actif",
    doit_changer_mdp: true,
  });

  return result;
});

export const processJoinRequest = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required");
  await assertAdmin(request.auth.uid);

  const data = (request.data ?? {}) as {
    requestId?: unknown;
    action?: unknown;
    password?: unknown;
  };

  const requestId = typeof data.requestId === "string" ? data.requestId.trim() : "";
  const action = data.action;
  const password = typeof data.password === "string" ? data.password : "";

  if (!requestId) throw new HttpsError("invalid-argument", "requestId is required");
  if (action !== "approve" && action !== "refuse") {
    throw new HttpsError("invalid-argument", "action must be approve or refuse");
  }

  const ref = db.collection("demandes_acces").doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Demande introuvable");

  const demande = snap.data() as {
    nom?: unknown;
    email?: unknown;
    telephone?: unknown;
    statut?: unknown;
  };

  if (demande.statut !== "en_attente") {
    throw new HttpsError("failed-precondition", "Cette demande a déjà été traitée");
  }

  if (action === "refuse") {
    await ref.update({
      statut: "refusee",
      date_traitement: FieldValue.serverTimestamp(),
      traite_par: request.auth.uid,
    });
    return { status: "refusee" as const };
  }

  const nom = typeof demande.nom === "string" ? demande.nom : "";
  const email = typeof demande.email === "string" ? demande.email : "";
  const telephone = typeof demande.telephone === "string" ? demande.telephone : undefined;

  const created = await createEmployeAccount({
    nom,
    email,
    password,
    telephone,
    statut: "actif",
    doit_changer_mdp: true,
  });

  await ref.update({
    statut: "approuvee",
    date_traitement: FieldValue.serverTimestamp(),
    traite_par: request.auth.uid,
    userId: created.uid,
  });

  return { status: "approuvee" as const, uid: created.uid, email: created.email };
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

async function getUserStatut(uid: string): Promise<"actif" | "desactive" | null> {
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return null;
  const statut = (snap.data() as { statut?: unknown } | undefined)?.statut;
  if (statut === "actif" || statut === "desactive") return statut;
  return "actif";
}

async function getGeofenceFromSettings(): Promise<{ latitude: number; longitude: number; radiusM: number } | null> {
  const snap = await db.collection("parametres_entreprise").doc("default").get();
  if (snap.exists) {
    const data = snap.data() as { latitude?: unknown; longitude?: unknown; rayon_metres?: unknown };
    const latitude = typeof data.latitude === "number" ? data.latitude : Number(data.latitude);
    const longitude = typeof data.longitude === "number" ? data.longitude : Number(data.longitude);
    const radiusM = typeof data.rayon_metres === "number" ? data.rayon_metres : Number(data.rayon_metres);
    if (Number.isFinite(latitude) && Number.isFinite(longitude) && Number.isFinite(radiusM) && radiusM > 0) {
      return { latitude, longitude, radiusM };
    }
  }

  const orgLatRaw = orgLat.value().trim();
  const orgLonRaw = orgLon.value().trim();
  const orgRadiusRaw = orgRadiusM.value().trim();
  if (!orgLatRaw || !orgLonRaw || !orgRadiusRaw) return null;
  const latitude = Number(orgLatRaw);
  const longitude = Number(orgLonRaw);
  const radiusM = Number(orgRadiusRaw);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(radiusM) || radiusM <= 0) {
    return null;
  }
  return { latitude, longitude, radiusM };
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

/** Bump sécurisé : `FieldValue.increment` échoue si `qrTokenVersion` n'est pas un nombre côté Firestore. */
function nextQrTokenVersion(prev: PointageSettings | null): number {
  const v = prev?.qrTokenVersion;
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v) + 1;
  if (typeof v === "string" && /^\d+$/.test(v.trim())) return Number(v.trim()) + 1;
  return 1;
}

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

  try {
    await ref.set(
      {
        // Store only hash going forward (token itself returned to admin caller)
        qrTokenHash: tokenHash,
        qrTokenVersion: nextQrTokenVersion(prev),
        previousQrTokenHash: previousToStore || FieldValue.delete(),
        allowPreviousHashUntil: previousToStore ? new Date(graceUntilMs) : FieldValue.delete(),
        qrExpiresAt: new Date(expiresAtMs),
        updatedAt: FieldValue.serverTimestamp(),
        // Keep legacy field empty to avoid leaking token via Firestore reads
        qrToken: FieldValue.delete(),
      },
      { merge: true },
    );
  } catch (err) {
    logger.error("rotatePointageQrWeekly: Firestore set failed", err);
    throw new HttpsError(
      "failed-precondition",
      "Impossible d'enregistrer le QR (Firestore). Consultez les logs de la fonction rotatePointageQrWeekly.",
    );
  }

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

  try {
    await ref.set(
      {
        qrTokenHash: tokenHash,
        qrTokenVersion: nextQrTokenVersion(prev),
        previousQrTokenHash: previousToStore || FieldValue.delete(),
        allowPreviousHashUntil: previousToStore ? new Date(graceUntilMs) : FieldValue.delete(),
        qrExpiresAt: new Date(expiresAtMs),
        updatedAt: FieldValue.serverTimestamp(),
        qrToken: FieldValue.delete(),
      },
      { merge: true },
    );
  } catch (err) {
    logger.error("scheduledRotatePointageQrWeekly: Firestore set failed", err);
    throw err;
  }

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

  const statut = await getUserStatut(uid);
  if (statut !== "actif") {
    throw new HttpsError("permission-denied", "Compte désactivé");
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

  try {
    await validatePointageQrFromFirestore(db, qr, qrToken.value(), qrSecret.value());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid QR token";
    if (message.includes("not configured")) {
      throw new HttpsError("failed-precondition", message);
    }
    throw new HttpsError("permission-denied", message);
  }

  const geofence = await getGeofenceFromSettings();
  if (!geofence) {
    throw new HttpsError("failed-precondition", "Paramètres entreprise (géolocalisation) non configurés");
  }

  const distance = haversineMeters(geofence.latitude, geofence.longitude, lat, lon);
  if (distance > geofence.radiusM) {
    throw new HttpsError("permission-denied", `Outside allowed area (${Math.round(distance)}m > ${Math.round(geofence.radiusM)}m)`);
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
