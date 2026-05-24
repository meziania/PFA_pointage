/** Jours fériés légaux au Maroc (dates fixes + fêtes religieuses renseignées par année). */
export type PublicHoliday = {
  date: string; // YYYY-MM-DD
  label: string;
};

const FIXED: Array<{ month: number; day: number; label: string }> = [
  { month: 1, day: 1, label: "Nouvel An" },
  { month: 1, day: 11, label: "Manifeste de l'Indépendance" },
  { month: 5, day: 1, label: "Fête du Travail" },
  { month: 7, day: 30, label: "Fête du Trône" },
  { month: 8, day: 14, label: "Récupération Oued Ed-Dahab" },
  { month: 8, day: 20, label: "Révolution du Roi et du Peuple" },
  { month: 8, day: 21, label: "Fête de la Jeunesse" },
  { month: 11, day: 6, label: "Marche Verte" },
  { month: 11, day: 18, label: "Fête de l'Indépendance" },
];

/** Dates officielles variables (à mettre à jour chaque année si besoin). */
const VARIABLE_BY_YEAR: Record<number, PublicHoliday[]> = {
  2025: [
    { date: "2025-03-31", label: "Aïd al-Fitr" },
    { date: "2025-04-01", label: "Aïd al-Fitr" },
    { date: "2025-06-07", label: "Aïd al-Adha" },
    { date: "2025-06-08", label: "Aïd al-Adha" },
    { date: "2025-09-05", label: "Mawlid (Achoura)" },
  ],
  2026: [
    { date: "2026-03-20", label: "Aïd al-Fitr" },
    { date: "2026-03-21", label: "Aïd al-Fitr" },
    { date: "2026-05-27", label: "Aïd al-Adha" },
    { date: "2026-05-28", label: "Aïd al-Adha" },
    { date: "2026-08-26", label: "Mawlid" },
  ],
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function getMoroccoHolidaysForYear(year: number): PublicHoliday[] {
  const fixed = FIXED.map((h) => ({
    date: `${year}-${pad(h.month)}-${pad(h.day)}`,
    label: h.label,
  }));
  const variable = VARIABLE_BY_YEAR[year] ?? [];
  return [...fixed, ...variable].sort((a, b) => a.date.localeCompare(b.date));
}

export function getMoroccoHolidaysInRange(start: string, end: string): PublicHoliday[] {
  const y0 = Number(start.slice(0, 4));
  const y1 = Number(end.slice(0, 4));
  const all: PublicHoliday[] = [];
  for (let y = y0; y <= y1; y += 1) {
    all.push(...getMoroccoHolidaysForYear(y));
  }
  return all.filter((h) => h.date >= start && h.date <= end);
}
