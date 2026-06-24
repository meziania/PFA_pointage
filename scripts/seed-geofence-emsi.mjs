import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULT_GEOFENCE = {
  label: "EMSI Moulay Youssef",
  latitude: 33.5926405,
  longitude: -7.6275635,
  rayon_metres: 150,
};

function initAdmin() {
  if (getApps().length) return;

  const keyPath = resolve(root, "serviceAccountKey.json");
  if (existsSync(keyPath)) {
    const sa = JSON.parse(readFileSync(keyPath, "utf8"));
    initializeApp({ credential: cert(sa) });
    return;
  }

  throw new Error("serviceAccountKey.json introuvable à la racine du projet");
}

async function main() {
  initAdmin();
  const db = getFirestore();

  await db.collection("parametres_entreprise").doc("default").set(
    {
      latitude: DEFAULT_GEOFENCE.latitude,
      longitude: DEFAULT_GEOFENCE.longitude,
      rayon_metres: DEFAULT_GEOFENCE.rayon_metres,
      site_label: DEFAULT_GEOFENCE.label,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: "seed-geofence-emsi",
    },
    { merge: true },
  );

  const snap = await db.collection("parametres_entreprise").doc("default").get();
  console.log("Geofence updated:", snap.data());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
