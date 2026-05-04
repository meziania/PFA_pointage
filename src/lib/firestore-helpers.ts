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
  where,
  addDoc,
  Timestamp,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase-firestore";
import type { CongeDoc, CongeStatut, PointageDoc, UserDoc, UserRole } from "@/lib/data-model";

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
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, userDoc);
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

