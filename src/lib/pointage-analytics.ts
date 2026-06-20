import type { PointageDoc, UserDoc } from "@/lib/data-model";

export type PointageRow = PointageDoc & { id: string };

export type EmployeeMini = {
  id: string;
  nom: string;
  email: string;
  role: UserDoc["role"];
  statut: UserDoc["statut"];
};

export type AnomalyRow = {
  key: string;
  userId: string;
  date: string;
  kind: string;
  details: string;
};

export function todayYmd(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function lastNDaysYmd(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const dd = new Date(d);
    dd.setDate(d.getDate() - i);
    const yyyy = dd.getFullYear();
    const mm = String(dd.getMonth() + 1).padStart(2, "0");
    const day = String(dd.getDate()).padStart(2, "0");
    out.push(`${yyyy}-${mm}-${day}`);
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
    const entries = arr.filter((x) => x.type === "entree").sort((a, b) => a.heure.localeCompare(b.heure));
    const exits = arr.filter((x) => x.type === "sortie").sort((a, b) => a.heure.localeCompare(b.heure));
    if (!entries.length || !exits.length) continue;
    total += hoursBetween(entries[0]!, exits[exits.length - 1]!);
  }
  return Math.round(total * 100) / 100;
}

export function computeAttendanceToday(activeEmployees: EmployeeMini[], rows: PointageRow[], ymd: string) {
  const activeIds = activeEmployees.map((e) => e.id);
  const presentIds = new Set(
    rows.filter((r) => r.date === ymd && r.type === "entree").map((r) => r.userId),
  );
  const present = activeIds.filter((id) => presentIds.has(id)).length;
  const absent = Math.max(0, activeIds.length - present);
  return { total: activeIds.length, present, absent };
}

export function detectAnomalies(rows: PointageRow[]): AnomalyRow[] {
  const byUserDate = new Map<string, PointageRow[]>();
  for (const r of rows) {
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
      result.push({ key, userId, date, kind: "Absence", details: "Aucune entrée" });
      continue;
    }

    const firstEntry = entries[0]!;
    if (firstEntry.heure > "09:00") {
      result.push({ key, userId, date, kind: "Retard", details: `Entrée à ${firstEntry.heure}` });
    }

    if (exits.length === 0) {
      result.push({ key, userId, date, kind: "Manquement", details: "Aucune sortie" });
      continue;
    }

    const lastExit = exits[exits.length - 1]!;
    if (lastExit.heure < "17:00") {
      result.push({ key, userId, date, kind: "Sortie anticipée", details: `Sortie à ${lastExit.heure}` });
    }

    const h = hoursBetween(firstEntry, lastExit);
    if (h < 8) {
      result.push({ key, userId, date, kind: "Insuffisance", details: `${h.toFixed(2)}h (< 8h)` });
    }
  }
  return result;
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
