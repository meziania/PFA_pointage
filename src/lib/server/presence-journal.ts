import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/server/firebase-admin";
import type { JournalPresenceDoc, PointageDoc } from "@/lib/data-model";
import {
  computeDayWorkedHours,
  WORK_RULES,
  type PointageRow,
} from "@/lib/pointage-analytics";

function journalDocId(userId: string, date: string): string {
  return `${userId}_${date}`;
}

export function computeJournalEntry(userId: string, date: string, dayRows: PointageRow[]): JournalPresenceDoc {
  const rows = [...dayRows].sort((a, b) => a.heure.localeCompare(b.heure));
  const entries = rows.filter((r) => r.type === "entree");
  const exits = rows.filter((r) => r.type === "sortie");
  const firstEntry = entries[0];
  const lastExit = exits.length ? exits[exits.length - 1] : undefined;

  let statut: JournalPresenceDoc["statut"] = "absent";
  if (firstEntry) {
    const isLate = firstEntry.heure > WORK_RULES.expectedStart;
    if (lastExit) statut = "sorti";
    else statut = isLate ? "retard" : "present";
  }

  const payload: JournalPresenceDoc = {
    userId,
    date,
    pointagesCount: rows.length,
    statut,
  };

  if (firstEntry) payload.entree = firstEntry.heure;
  if (lastExit) payload.sortie = lastExit.heure;
  if (firstEntry && rows.length) payload.heures = computeDayWorkedHours(rows);
  return payload;
}

export async function refreshJournalPresenceForDay(userId: string, date: string): Promise<void> {
  const snap = await getAdminDb()
    .collection("pointages")
    .where("userId", "==", userId)
    .where("date", "==", date)
    .get();

  const dayRows: PointageRow[] = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as PointageDoc),
  }));

  const payload = computeJournalEntry(userId, date, dayRows);
  await getAdminDb()
    .collection("journal_presence")
    .doc(journalDocId(userId, date))
    .set({ ...payload, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export async function listJournalPresenceAdmin(params: {
  fromYmd: string;
  toYmd: string;
  userId?: string;
}): Promise<Array<JournalPresenceDoc & { id: string }>> {
  const [journalSnap, pointages] = await Promise.all([
    (async () => {
      let q = getAdminDb()
        .collection("journal_presence")
        .where("date", ">=", params.fromYmd)
        .where("date", "<=", params.toYmd);
      if (params.userId) q = q.where("userId", "==", params.userId) as typeof q;
      return q.get();
    })(),
    listPointagesAdmin({ fromYmd: params.fromYmd, toYmd: params.toYmd, userId: params.userId, limit: 3000 }),
  ]);

  const byKey = new Map<string, JournalPresenceDoc & { id: string }>();
  for (const doc of journalSnap.docs) {
    const data = doc.data() as JournalPresenceDoc;
    byKey.set(`${data.userId}|${data.date}`, { id: doc.id, ...data });
  }

  const pointagesByKey = new Map<string, PointageRow[]>();
  for (const p of pointages) {
    const key = `${p.userId}|${p.date}`;
    const arr = pointagesByKey.get(key) ?? [];
    arr.push({ ...p });
    pointagesByKey.set(key, arr);
  }

  for (const [key, dayRows] of pointagesByKey) {
    if (byKey.has(key)) continue;
    const [userId = "", date = ""] = key.split("|");
    const computed = computeJournalEntry(userId, date, dayRows);
    byKey.set(key, { id: journalDocId(userId, date), ...computed });
  }

  const rows = [...byKey.values()];
  rows.sort((a, b) => b.date.localeCompare(a.date) || a.userId.localeCompare(b.userId));
  return rows;
}

export async function listPointagesAdmin(params: {
  fromYmd: string;
  toYmd: string;
  userId?: string;
  limit?: number;
}): Promise<Array<PointageDoc & { id: string }>> {
  let q = getAdminDb()
    .collection("pointages")
    .where("date", ">=", params.fromYmd)
    .where("date", "<=", params.toYmd);

  if (params.userId) {
    q = q.where("userId", "==", params.userId) as typeof q;
  }

  const snap = await q.get();
  let rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as PointageDoc) }));
  rows.sort((a, b) => {
    const dc = b.date.localeCompare(a.date);
    if (dc !== 0) return dc;
    return b.heure.localeCompare(a.heure);
  });
  if (params.limit && rows.length > params.limit) {
    rows = rows.slice(0, params.limit);
  }
  return rows;
}
