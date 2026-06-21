import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  isWeekend,
  parseISO,
  startOfMonth,
} from "date-fns";
import { fr } from "date-fns/locale";
import { Timestamp } from "firebase/firestore";
import type { CongeDoc, CongeStatut, CongeType } from "@/lib/data-model";
import type { PublicHoliday } from "@/lib/morocco-holidays";

export type CalendarEventKind =
  | "ferie"
  | "annuel"
  | "maladie"
  | "exceptionnel"
  | "en_attente";

export type CalendarEvent = {
  kind: CalendarEventKind;
  label: string;
  userId?: string;
  userName?: string;
  statut?: CongeStatut;
};

export type CalendarDay = {
  date: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isWeekend: boolean;
  events: CalendarEvent[];
};

export type CongeCalendarRow = CongeDoc & { id: string; userName?: string };

function toDateStr(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** Normalise dateDebut/dateFin depuis Firestore (string ISO ou Timestamp). */
export function congeDateToYmd(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const s = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = parseISO(s);
    return Number.isNaN(d.getTime()) ? null : toDateStr(d);
  }
  if (value instanceof Timestamp) {
    return toDateStr(value.toDate());
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toDateStr(value);
  }
  return null;
}

const KIND_PRIORITY: Record<CalendarEventKind, number> = {
  ferie: 0,
  en_attente: 1,
  annuel: 2,
  exceptionnel: 3,
  maladie: 4,
};

function sortDayEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind]);
}

export function primaryEventKind(events: CalendarEvent[]): CalendarEventKind | null {
  if (!events.length) return null;
  return sortDayEvents(events)[0]?.kind ?? null;
}

export function formatMonthYear(month: Date): string {
  return format(month, "MMMM yyyy", { locale: fr });
}

export function monthGrid(month: Date): CalendarDay[] {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const gridStart = addDays(start, -((start.getDay() + 6) % 7));
  const gridEnd = addDays(end, 6 - ((end.getDay() + 6) % 7));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return days.map((d) => ({
    date: toDateStr(d),
    dayOfMonth: d.getDate(),
    isCurrentMonth: d.getMonth() === month.getMonth(),
    isWeekend: isWeekend(d),
    events: [],
  }));
}

function congeKind(type: CongeType, statut: CongeStatut): CalendarEventKind {
  if (statut === "en_attente") return "en_attente";
  if (type === "maladie") return "maladie";
  if (type === "exceptionnel") return "exceptionnel";
  return "annuel";
}

function typeLabel(type: CongeType): string {
  if (type === "maladie") return "Maladie";
  if (type === "exceptionnel") return "Exceptionnel";
  return "Congé annuel";
}

export function buildCalendarDays(
  month: Date,
  conges: CongeCalendarRow[],
  holidays: PublicHoliday[],
  options?: { includePending?: boolean; onlyValidated?: boolean },
): CalendarDay[] {
  const includePending = options?.includePending ?? true;
  const onlyValidated = options?.onlyValidated ?? false;

  const days = monthGrid(month);
  const byDate = new Map(days.map((d) => [d.date, d]));

  for (const h of holidays) {
    const cell = byDate.get(h.date);
    if (!cell) continue;
    cell.events.push({ kind: "ferie", label: h.label });
  }

  for (const c of conges) {
    if (onlyValidated && c.statut !== "valide") continue;
    if (!includePending && c.statut === "en_attente") continue;
    if (c.statut === "refuse") continue;

    const debutYmd = congeDateToYmd(c.dateDebut);
    const finYmd = congeDateToYmd(c.dateFin);
    if (!debutYmd || !finYmd) continue;

    let start: Date;
    let end: Date;
    try {
      start = parseISO(debutYmd);
      end = parseISO(finYmd);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
      if (end < start) continue;
    } catch {
      continue;
    }

    const range = eachDayOfInterval({ start, end });
    const kind = congeKind(c.type, c.statut);
    const label = c.userName ? `${typeLabel(c.type)} — ${c.userName}` : typeLabel(c.type);

    for (const d of range) {
      const key = toDateStr(d);
      const cell = byDate.get(key);
      if (!cell) continue;
      cell.events.push({
        kind,
        label,
        userId: c.userId,
        userName: c.userName,
        statut: c.statut,
      });
    }
  }

  for (const cell of days) {
    cell.events = sortDayEvents(cell.events);
  }

  return days;
}

export function eventKindLabel(kind: CalendarEventKind): string {
  switch (kind) {
    case "ferie":
      return "Jour férié";
    case "maladie":
      return "Maladie";
    case "exceptionnel":
      return "Exceptionnel";
    case "en_attente":
      return "En attente";
    default:
      return "Congé annuel";
  }
}

export function eventKindClass(kind: CalendarEventKind): string {
  switch (kind) {
    case "ferie":
      return "bg-violet-500/25 text-violet-900 border-violet-500/40";
    case "maladie":
      return "bg-rose-500/20 text-rose-900 border-rose-500/35";
    case "exceptionnel":
      return "bg-sky-500/20 text-sky-900 border-sky-500/35";
    case "en_attente":
      return "bg-amber-500/25 text-amber-950 border-amber-500/40";
    default:
      return "bg-[color-mix(in_oklch,var(--success)_22%,transparent)] text-foreground border-[color-mix(in_oklch,var(--success)_40%,transparent)]";
  }
}
