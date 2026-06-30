import type { CongeDoc, PointageDoc, UserDoc } from "@/lib/data-model";
import { getMoroccoHolidaysInRange } from "@/lib/morocco-holidays";
import { getMoroccoNowParts, moroccoYmdDaysAgo } from "@/lib/pointage-time";

export type PointageRow = PointageDoc & { id: string };

export type EmployeeMini = {
  id: string;
  nom: string;
  email: string;
  role: UserDoc["role"];
  statut: UserDoc["statut"];
  departement?: string;
};

export type CongeMini = Pick<CongeDoc, "userId" | "dateDebut" | "dateFin" | "statut">;

export type AnomalyRow = {
  key: string;
  userId: string;
  date: string;
  kind: string;
  details: string;
};

export type PresenceDayStatus = "present" | "retard" | "absent" | "en_conge" | "sorti";

export type PresenceBoardRow = {
  userId: string;
  status: PresenceDayStatus;
  entree?: string;
  sortie?: string;
  heures?: number;
  details?: string;
};

/** Règles métier alignées avec la vue employé (historique). */
export const WORK_RULES = {
  expectedStart: "08:30",
  expectedEnd: "17:00",
  minHours: 8,
} as const;

export const PRESENCE_STATUS_LABELS: Record<PresenceDayStatus, string> = {
  present: "Présent",
  retard: "Retard",
  absent: "Absent",
  en_conge: "En congé",
  sorti: "Parti",
};

export function todayYmd(): string {
  return getMoroccoNowParts().ymd;
}

export function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

/** Heures travaillées sur une journée (paires entrée/sortie chronologiques). */
export function computeDayWorkedHours(dayRows: PointageRow[]): number {
  const list = [...dayRows].sort((a, b) => (toMinutes(a.heure) ?? 0) - (toMinutes(b.heure) ?? 0));
  let open: number | null = null;
  let totalMinutes = 0;
  for (const r of list) {
    const t = toMinutes(r.heure);
    if (t === null) continue;
    if (r.type === "entree") open = t;
    else if (r.type === "sortie" && open !== null && t >= open) {
      totalMinutes += t - open;
      open = null;
    }
  }
  return Math.round((totalMinutes / 60) * 100) / 100;
}

export function isWorkday(ymd: string, holidayDates?: Set<string>): boolean {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return false;
  const dow = new Date(y, m - 1, d).getDay();
  if (dow === 0 || dow === 6) return false;
  if (holidayDates?.has(ymd)) return false;
  return true;
}

export function buildHolidayDateSet(dates: string[]): Set<string> {
  if (!dates.length) return new Set();
  const sorted = [...dates].sort();
  const start = sorted[0]!;
  const end = sorted[sorted.length - 1]!;
  return new Set(getMoroccoHolidaysInRange(start, end).map((h) => h.date));
}

export function lastNDaysYmd(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    out.push(moroccoYmdDaysAgo(i));
  }
  return out;
}

export function ymdToTime(ymd: string): number {
  return Date.parse(`${ymd}T00:00:00`);
}

export function hoursBetween(entry: Pick<PointageDoc, "heure">, exit: Pick<PointageDoc, "heure">): number {
  const [eh, em] = entry.heure.split(":").map(Number);
  const [sh, sm] = exit.heure.split(":").map(Number);
  const entryMin = eh * 60 + em;
  const exitMin = sh * 60 + sm;
  return Math.max(0, (exitMin - entryMin) / 60);
}

export function isActiveEmployee(u: EmployeeMini): boolean {
  return u.role === "employe" && (u.statut ?? "actif") === "actif";
}

export function computeDailyHours(rows: PointageRow[], ymd: string): number {
  const byUser = new Map<string, PointageRow[]>();
  for (const r of rows) {
    if (r.date !== ymd) continue;
    const arr = byUser.get(r.userId) ?? [];
    arr.push(r);
    byUser.set(r.userId, arr);
  }

  let total = 0;
  for (const arr of byUser.values()) {
    total += computeDayWorkedHours(arr);
  }
  return Math.round(total * 100) / 100;
}

export function isDateInCongeRange(ymd: string, conge: CongeMini): boolean {
  if (conge.statut !== "valide") return false;
  const t = ymdToTime(ymd);
  return t >= ymdToTime(conge.dateDebut) && t <= ymdToTime(conge.dateFin);
}

export function usersOnLeaveForDate(conges: CongeMini[], ymd: string): Set<string> {
  const ids = new Set<string>();
  for (const c of conges) {
    if (isDateInCongeRange(ymd, c)) ids.add(c.userId);
  }
  return ids;
}

export function buildLeaveKeys(conges: CongeMini[], dates: string[]): Set<string> {
  const keys = new Set<string>();
  for (const c of conges) {
    if (c.statut !== "valide") continue;
    for (const d of dates) {
      if (isDateInCongeRange(d, c)) keys.add(`${c.userId}|${d}`);
    }
  }
  return keys;
}

export function computeTodayPresenceBoard(
  activeEmployees: EmployeeMini[],
  rows: PointageRow[],
  ymd: string,
  onLeaveIds: Set<string>,
): PresenceBoardRow[] {
  const byUser = new Map<string, PointageRow[]>();
  for (const r of rows) {
    if (r.date !== ymd) continue;
    const arr = byUser.get(r.userId) ?? [];
    arr.push(r);
    byUser.set(r.userId, arr);
  }

  return activeEmployees.map((emp) => {
    if (onLeaveIds.has(emp.id)) {
      return { userId: emp.id, status: "en_conge" as const, details: "Congé validé" };
    }

    const dayRows = byUser.get(emp.id) ?? [];
    const entries = dayRows.filter((x) => x.type === "entree").sort((a, b) => a.heure.localeCompare(b.heure));
    const exits = dayRows.filter((x) => x.type === "sortie").sort((a, b) => a.heure.localeCompare(b.heure));

    if (!entries.length) {
      return { userId: emp.id, status: "absent" as const, details: "Aucun pointage entrée" };
    }

    const firstEntry = entries[0]!;
    const lastExit = exits.length ? exits[exits.length - 1]! : undefined;
    const isLate = firstEntry.heure > WORK_RULES.expectedStart;

    if (lastExit) {
      const h = computeDayWorkedHours(dayRows);
      return {
        userId: emp.id,
        status: "sorti" as const,
        entree: firstEntry.heure,
        sortie: lastExit.heure,
        heures: h,
        details: isLate ? `Entrée à ${firstEntry.heure}` : undefined,
      };
    }

    return {
      userId: emp.id,
      status: isLate ? ("retard" as const) : ("present" as const),
      entree: firstEntry.heure,
      details: isLate ? `Entrée à ${firstEntry.heure}` : "Sur site",
    };
  });
}

export function computePresenceRateToday(board: PresenceBoardRow[]): number {
  const countable = board.filter((r) => r.status !== "en_conge");
  if (!countable.length) return 0;
  const present = countable.filter((r) => r.status !== "absent").length;
  return Math.round((present / countable.length) * 100);
}

export function countAnomaliesByKind(anomalies: AnomalyRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const a of anomalies) {
    counts[a.kind] = (counts[a.kind] ?? 0) + 1;
  }
  return counts;
}

export function detectAnomalies(rows: PointageRow[], opts?: { skipAbsenceKeys?: Set<string> }): AnomalyRow[] {
  const skip = opts?.skipAbsenceKeys;
  const byUserDate = new Map<string, PointageRow[]>();
  for (const r of rows) {
    if (r.valide === false) continue;
    const key = `${r.userId}|${r.date}`;
    const arr = byUserDate.get(key) ?? [];
    arr.push(r);
    byUserDate.set(key, arr);
  }

  const result: AnomalyRow[] = [];
  for (const [key, arr] of byUserDate.entries()) {
    const [userId = key, date = ""] = key.split("|");
    const entries = arr.filter((x) => x.type === "entree").sort((a, b) => a.heure.localeCompare(b.heure));
    const exits = arr.filter((x) => x.type === "sortie").sort((a, b) => a.heure.localeCompare(b.heure));

    if (entries.length === 0) {
      if (!skip?.has(key)) {
        result.push({ key, userId, date, kind: "Absence", details: "Aucune entrée enregistrée" });
      }
      continue;
    }

    const firstEntry = entries[0]!;
    if (firstEntry.heure > WORK_RULES.expectedStart) {
      result.push({ key, userId, date, kind: "Retard", details: `Entrée à ${firstEntry.heure}` });
    }

    if (exits.length === 0) {
      result.push({ key, userId, date, kind: "Manquement", details: "Aucune sortie" });
      continue;
    }

    const lastExit = exits[exits.length - 1]!;
    if (lastExit.heure < WORK_RULES.expectedEnd) {
      result.push({ key, userId, date, kind: "Sortie anticipée", details: `Sortie à ${lastExit.heure}` });
    }

    const h = computeDayWorkedHours(arr);
    if (h < WORK_RULES.minHours) {
      result.push({ key, userId, date, kind: "Insuffisance", details: `${h.toFixed(2)}h (< ${WORK_RULES.minHours}h)` });
    }
  }
  return result;
}

/** Absences planifiées : employés actifs sans entrée sur jours ouvrés (hors congés). */
export function detectScheduledAbsences(
  activeEmployees: EmployeeMini[],
  dates: string[],
  rows: PointageRow[],
  conges: CongeMini[],
  opts?: { holidayDates?: Set<string> },
): AnomalyRow[] {
  const leaveKeys = buildLeaveKeys(conges, dates);
  const withEntry = new Set<string>();
  for (const r of rows) {
    if (r.valide === false) continue;
    if (r.type === "entree") withEntry.add(`${r.userId}|${r.date}`);
  }

  const today = todayYmd();
  const result: AnomalyRow[] = [];
  for (const date of dates) {
    if (!isWorkday(date, opts?.holidayDates)) continue;
    if (ymdToTime(date) > ymdToTime(today)) continue;

    for (const emp of activeEmployees) {
      const key = `${emp.id}|${date}`;
      if (leaveKeys.has(key)) continue;
      if (withEntry.has(key)) continue;
      result.push({ key, userId: emp.id, date, kind: "Absence", details: "Aucune entrée" });
    }
  }
  return result;
}

export function mergeAnomalies(pointageAnomalies: AnomalyRow[], scheduledAbsences: AnomalyRow[]): AnomalyRow[] {
  const withoutDuplicateAbsence = pointageAnomalies.filter((a) => a.kind !== "Absence");
  const keys = new Set(withoutDuplicateAbsence.map((a) => `${a.key}|${a.kind}`));
  const merged = [...withoutDuplicateAbsence];
  for (const a of scheduledAbsences) {
    const k = `${a.key}|${a.kind}`;
    if (!keys.has(k)) {
      keys.add(k);
      merged.push(a);
    }
  }
  return merged.sort((a, b) => b.date.localeCompare(a.date) || a.kind.localeCompare(b.kind));
}

export function enumerateYmdRange(start: string, end: string): string[] {
  const pad = (n: number) => String(n).padStart(2, "0");
  const out: string[] = [];
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  if (!sy || !sm || !sd || !ey || !em || !ed) return out;
  const cur = new Date(sy, sm - 1, sd);
  const last = new Date(ey, em - 1, ed);
  while (cur <= last) {
    out.push(`${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function filterPointages(
  rows: PointageRow[],
  opts: {
    employeeId: string;
    filterMode: "day" | "range";
    date: string;
    dateDebut: string;
    dateFin: string;
  },
): PointageRow[] {
  const emp = opts.employeeId.trim();
  return rows.filter((r) => {
    if (emp && r.userId !== emp) return false;

    if (opts.filterMode === "day") {
      const d = opts.date.trim();
      if (d && r.date !== d) return false;
      return true;
    }

    const start = opts.dateDebut.trim();
    const end = opts.dateFin.trim();
    if (!start && !end) return true;

    const t = ymdToTime(r.date);
    if (start && t < ymdToTime(start)) return false;
    if (end && t > ymdToTime(end)) return false;
    return true;
  });
}
