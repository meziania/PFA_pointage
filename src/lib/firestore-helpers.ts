import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteField,
  where,
  addDoc,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase-firestore";
import type { CongeDoc, CongeStatut, DemandeAdhesionDoc, DemandeAdhesionStatut, PointageDoc, UserDoc, UserRole } from "@/lib/data-model";

function requireDb() {
  const db = getFirebaseFirestore();
  if (!db) throw new Error("Firestore not initialized");
  return db;
}

export async function ensureUserDoc(params: {
  uid: string;
  nom: string;
  email: string;
  role?: UserRole;
}): Promise<void> {
  const db = requireDb();
  const ref = doc(db, "users", params.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;

  const userDoc: UserDoc = {
    nom: params.nom,
    email: params.email,
    role: params.role ?? "employe",
    statut: "actif",
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, userDoc);
}

export async function getUserStatut(uid: string): Promise<UserDoc["statut"] | null> {
  const doc = await getUserDoc(uid);
  if (!doc) return null;
  return doc.statut ?? "actif";
}

export async function userMustChangePassword(uid: string): Promise<boolean> {
  const userDoc = await getUserDoc(uid);
  return Boolean(userDoc?.doit_changer_mdp);
}

export async function getUserRole(uid: string): Promise<UserRole | null> {
  const db = requireDb();
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as Partial<UserDoc>;
  if (data.role === "admin" || data.role === "employe") return data.role;
  return null;
}

export async function getUserDoc(uid: string): Promise<(UserDoc & { id: string }) | null> {
  const db = requireDb();
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as UserDoc) };
}

export async function updateUserDoc(uid: string, patch: Partial<UserDoc>): Promise<void> {
  const db = requireDb();
  const ref = doc(db, "users", uid);
  await updateDoc(ref, patch);
}

/** Champs modifiables par l'employé (aligné sur firestore.rules — pas d'email ni role). */
export type EmployeeProfilePatch = Pick<
  UserDoc,
  "nom" | "matricule" | "telephone" | "departement" | "poste" | "cin" | "adresse" | "dateNaissance" | "dateEmbauche"
>;

function buildEmployeeProfileData(
  patch: EmployeeProfilePatch,
  existing?: Record<string, unknown>,
): Record<string, unknown> {
  const data: Record<string, unknown> = { nom: patch.nom.trim() };

  const optional: (keyof EmployeeProfilePatch)[] = [
    "matricule",
    "telephone",
    "departement",
    "poste",
    "cin",
    "adresse",
    "dateNaissance",
    "dateEmbauche",
  ];

  for (const key of optional) {
    const v = patch[key];
    if (typeof v !== "string") continue;
    const trimmed = v.trim();
    if (trimmed) {
      data[key] = trimmed;
    } else if (existing && key in existing) {
      data[key] = deleteField();
    }
  }

  return data;
}

export async function updateEmployeeProfile(
  uid: string,
  patch: EmployeeProfilePatch,
  context: { email: string },
): Promise<void> {
  const db = requireDb();
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? snap.data() : undefined;
  const data = buildEmployeeProfileData(patch, existing);

  if (!snap.exists()) {
    throw new Error("Profil introuvable. Contactez l'administrateur.");
  }

  await updateDoc(ref, data);
}

export async function listPointagesForUser(uid: string, take = 50): Promise<Array<PointageDoc & { id: string }>> {
  const db = requireDb();
  // Avoid composite index requirement: no orderBy here; sort client-side.
  const q = query(collection(db, "pointages"), where("userId", "==", uid), limit(take));
  const snaps = await getDocs(q);
  const rows = snaps.docs.map((d) => ({ id: d.id, ...(d.data() as PointageDoc) }));
  rows.sort((a, b) => {
    const aa = unwrapTimestamp(a.createdAt)?.getTime() ?? Date.parse(`${a.date}T${a.heure}:00`);
    const bb = unwrapTimestamp(b.createdAt)?.getTime() ?? Date.parse(`${b.date}T${b.heure}:00`);
    return bb - aa;
  });
  return rows;
}

export async function listPointages(take = 200): Promise<Array<PointageDoc & { id: string }>> {
  const db = requireDb();
  const q = query(collection(db, "pointages"), orderBy("createdAt", "desc"), limit(take));
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({ id: d.id, ...(d.data() as PointageDoc) }));
}

export async function listPendingJoinRequests(take = 50): Promise<Array<DemandeAdhesionDoc & { id: string }>> {
  const db = requireDb();
  const q = query(
    collection(db, "demandes_acces"),
    where("statut", "==", "en_attente"),
    orderBy("date_demande", "desc"),
    limit(take),
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({ id: d.id, ...(d.data() as DemandeAdhesionDoc) }));
}

export async function listJoinRequests(take = 100): Promise<Array<DemandeAdhesionDoc & { id: string }>> {
  const db = requireDb();
  const q = query(collection(db, "demandes_acces"), orderBy("date_demande", "desc"), limit(take));
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({ id: d.id, ...(d.data() as DemandeAdhesionDoc) }));
}

export async function updateJoinRequestStatut(
  requestId: string,
  statut: DemandeAdhesionStatut,
  extra?: { processedBy?: string; userId?: string },
): Promise<void> {
  const db = requireDb();
  await updateDoc(doc(db, "demandes_acces", requestId), {
    statut,
    date_traitement: serverTimestamp(),
    ...(extra?.processedBy ? { traite_par: extra.processedBy } : {}),
    ...(extra?.userId ? { userId: extra.userId } : {}),
  });
}

export async function requestConge(docData: Omit<CongeDoc, "createdAt" | "statut">): Promise<string> {
  const db = requireDb();
  const ref = await addDoc(collection(db, "conges"), {
    ...docData,
    statut: "en_attente" satisfies CongeStatut,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listCongesForUser(uid: string, take = 50): Promise<Array<CongeDoc & { id: string }>> {
  const db = requireDb();
  const q = query(collection(db, "conges"), where("userId", "==", uid), orderBy("createdAt", "desc"), limit(take));
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({ id: d.id, ...(d.data() as CongeDoc) }));
}

export async function listPendingConges(take = 50): Promise<Array<CongeDoc & { id: string }>> {
  const db = requireDb();
  const q = query(
    collection(db, "conges"),
    where("statut", "==", "en_attente"),
    orderBy("createdAt", "desc"),
    limit(take),
  );
  const snaps = await getDocs(q);
  return snaps.docs.map((d) => ({ id: d.id, ...(d.data() as CongeDoc) }));
}

export async function updateCongeStatut(congeId: string, statut: CongeStatut): Promise<void> {
  const db = requireDb();
  await updateDoc(doc(db, "conges", congeId), { statut });
}

export function toYMD(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function toHM(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function unwrapTimestamp(ts: unknown): Date | null {
  if (ts instanceof Timestamp) return ts.toDate();
  return null;
}

/** Marque une ou plusieurs notifications comme lues (propriétaire uniquement). */
export async function markNotificationsAsRead(notificationIds: string[]): Promise<void> {
  if (!notificationIds.length) return;
  const db = requireDb();
  const batch = writeBatch(db);
  for (const id of notificationIds) {
    batch.update(doc(db, "notifications", id), { read: true });
  }
  await batch.commit();
}

