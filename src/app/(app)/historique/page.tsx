"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { eachDayOfInterval, endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/providers/auth-provider";
import { listCongesForUser, listPointagesForUser } from "@/lib/firestore-helpers";
import type { CongeDoc, PointageDoc } from "@/lib/data-model";
import {
  WORK_RULES,
  buildHolidayDateSet,
  computeDayWorkedHours,
  isDateInCongeRange,
  isWorkday,
  toMinutes,
} from "@/lib/pointage-analytics";

type Row = PointageDoc & { id: string };

type FilterKey = "all" | "entree" | "sortie" | "retards";

function fmtHours(hours: number): string {
  if (!Number.isFinite(hours)) return "0 h";
  return `${Math.round(hours)} h`;
}

function downloadText(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(v: string): string {
  const s = v ?? "";
  if (/[",\n]/.test(s)) return `"${s.replaceAll("\"", "\"\"")}"`;
  return s;
}

export default function HistoriquePage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [conges, setConges] = useState<CongeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));

  const expectedStart = WORK_RULES.expectedStart;

  useEffect(() => {
    if (!user) return;
    queueMicrotask(() => setLoading(true));
    const fromYmd = `${month}-01`;
    Promise.all([
      listPointagesForUser(user.uid, { fromYmd, take: 400 }),
      listCongesForUser(user.uid, 100),
    ])
      .then(([pointages, congesRows]) => {
        setRows(pointages);
        setConges(congesRows);
      })
      .catch((err) => {
        const code = (err as { code?: string })?.code;
        toast.error(code === "permission-denied" ? "Accès refusé (règles Firestore)." : "Impossible de charger l'historique");
      })
      .finally(() => setLoading(false));
  }, [user, month]);

  const monthRows = useMemo(() => {
    const prefix = `${month}-`;
    return rows.filter((r) => typeof r.date === "string" && r.date.startsWith(prefix));
  }, [rows, month]);

  const computed = useMemo(() => {
    const expectedMin = toMinutes(expectedStart) ?? 510;

    const byDay = new Map<string, Array<Row>>();
    for (const r of monthRows) {
      if (!byDay.has(r.date)) byDay.set(r.date, []);
      byDay.get(r.date)!.push(r);
    }

    // Sort within day
    for (const list of byDay.values()) {
      list.sort((a, b) => (toMinutes(a.heure) ?? 0) - (toMinutes(b.heure) ?? 0));
    }

    let totalMinutes = 0;
    let retardCount = 0;
    let anomalies: Array<{ date: string; minutesLate: number }> = [];

    for (const [date, list] of byDay) {
      const firstEntree = list.find((x) => x.type === "entree");
      const firstEntreeMin = firstEntree ? toMinutes(firstEntree.heure) : null;
      if (firstEntreeMin !== null && firstEntreeMin > expectedMin) {
        const late = firstEntreeMin - expectedMin;
        retardCount += 1;
        anomalies.push({ date, minutesLate: late });
      }

      totalMinutes += computeDayWorkedHours(list) * 60;
    }

    const periodStart = startOfMonth(parseISO(`${month}-01`));
    const periodEnd = endOfMonth(periodStart);
    const holidayDates = buildHolidayDateSet(
      eachDayOfInterval({ start: periodStart, end: periodEnd }).map((d) => format(d, "yyyy-MM-dd")),
    );
    const workdays = eachDayOfInterval({ start: periodStart, end: periodEnd }).filter((d) =>
      isWorkday(format(d, "yyyy-MM-dd"), holidayDates),
    );
    const countableWorkdays = workdays.filter((d) => {
      const ymd = format(d, "yyyy-MM-dd");
      return !conges.some((c) => isDateInCongeRange(ymd, c));
    });
    const presentAmongCountable = countableWorkdays.filter((d) => byDay.has(format(d, "yyyy-MM-dd"))).length;
    const absences = Math.max(0, countableWorkdays.length - presentAmongCountable);
    const presenceRate =
      countableWorkdays.length > 0 ? Math.round((presentAmongCountable / countableWorkdays.length) * 100) : 0;

    anomalies = anomalies
      .sort((a, b) => b.minutesLate - a.minutesLate)
      .slice(0, 3);

    return {
      totalHours: totalMinutes / 60,
      retardCount,
      absences,
      presenceRate,
      anomalies,
      byDay,
      expectedStart,
    };
  }, [monthRows, month, expectedStart, conges]);

  const viewRows = useMemo(() => {
    const expectedMin = toMinutes(computed.expectedStart) ?? 510;
    const withLate = (r: Row) => {
      if (r.type !== "entree") return false;
      const m = toMinutes(r.heure);
      return m !== null && m > expectedMin;
    };

    const base =
      filter === "entree"
        ? monthRows.filter((r) => r.type === "entree")
        : filter === "sortie"
          ? monthRows.filter((r) => r.type === "sortie")
          : filter === "retards"
            ? monthRows.filter(withLate)
            : monthRows;

    return base.slice().sort((a, b) => {
      const aa = Date.parse(`${a.date}T${a.heure}:00`);
      const bb = Date.parse(`${b.date}T${b.heure}:00`);
      return bb - aa;
    });
  }, [monthRows, filter, computed.expectedStart]);

  const monthLabel = useMemo(() => {
    try {
      const d = parseISO(`${month}-01`);
      return format(d, "LLLL yyyy");
    } catch {
      return month;
    }
  }, [month]);

  if (!user) return null;

  const pills: Array<{ key: FilterKey; label: string }> = [
    { key: "all", label: "Tous" },
    { key: "entree", label: "Entrée" },
    { key: "sortie", label: "Sortie" },
    { key: "retards", label: "Retards" },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div>
            <h1 className="page-title">Historique des pointages</h1>
            <p className="page-subtitle">{loading ? "Chargement..." : `${monthRows.length} pointage(s) ce mois`}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => {
              const header = ["date", "heure", "type", "latitude", "longitude"];
              const lines = viewRows.map((r) => [
                r.date,
                r.heure,
                r.type,
                typeof r.latitude === "number" ? String(r.latitude) : "",
                typeof r.longitude === "number" ? String(r.longitude) : "",
              ]);
              const csv = [header, ...lines].map((row) => row.map(csvEscape).join(",")).join("\n");
              downloadText(`pointages-${month}.csv`, csv, "text/csv;charset=utf-8");
            }}
          >
            Exporter CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Heures ce mois</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{fmtHours(computed.totalHours)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Retards</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[color-mix(in_oklch,var(--warning)_70%,white)]">{computed.retardCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Absences</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[color-mix(in_oklch,var(--destructive)_70%,white)]">{computed.absences}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Taux présence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[color-mix(in_oklch,var(--success)_70%,white)]">{computed.presenceRate}%</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
          {pills.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setFilter(p.key)}
              className={
                filter === p.key
                  ? "rounded-full border bg-muted px-4 py-2 text-sm font-medium"
                  : "rounded-full border bg-background px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
              }
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="rounded-full border bg-background px-4 py-2 text-sm text-muted-foreground">{monthLabel}</div>
          <input
            className="h-11 w-full rounded-md border bg-background px-3 text-sm sm:w-auto touch-target"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
      </div>

      {computed.anomalies.length > 0 ? (
        <div className="rounded-lg border bg-[color-mix(in_oklch,var(--warning)_18%,transparent)] px-4 py-3 text-sm">
          <span className="font-medium">{computed.anomalies.length} anomalie(s) détectée(s)</span>
          {" — "}
          {computed.anomalies[0] ? (
            <span>
              retard de {computed.anomalies[0].minutesLate} min le {computed.anomalies[0].date.slice(8, 10)}/{computed.anomalies[0].date.slice(5, 7)}
            </span>
          ) : null}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Pointages</CardTitle>
          <CardDescription>{loading ? "Chargement..." : `${viewRows.length} ligne(s)`}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 md:hidden">
            {viewRows.map((r) => {
              const isEntree = r.type === "entree";
              const expectedMin = toMinutes(computed.expectedStart) ?? 510;
              const m = toMinutes(r.heure);
              const lateMin = isEntree && m !== null && m > expectedMin ? m - expectedMin : 0;
              const status = lateMin > 0 ? `Retard ${lateMin} min` : "Normal";
              return (
                <div key={r.id} className="rounded-xl border border-brand/10 bg-background p-3 text-sm shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-brand-dark">{r.date.split("-").reverse().join("/")}</div>
                      <div className="text-muted-foreground">{r.heure}</div>
                    </div>
                    <span
                      className={
                        isEntree
                          ? "rounded-full bg-status-approved-bg px-2.5 py-0.5 text-xs font-medium text-status-approved-text"
                          : "rounded-full bg-status-rejected-bg px-2.5 py-0.5 text-xs font-medium text-status-rejected-text"
                      }
                    >
                      {isEntree ? "Entrée" : "Sortie"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">{status}</span>
                    {typeof r.latitude === "number" ? (
                      <span className="text-muted-foreground">{r.latitude.toFixed(3)}°, {r.longitude?.toFixed(3)}°</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {!loading && viewRows.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground">Aucun pointage pour le moment.</p>
            ) : null}
          </div>

          <div className="hidden md:block">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Heure</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Localisation</th>
                  <th className="py-2 pr-4">Statut</th>
                </tr>
              </thead>
              <tbody>
                {viewRows.map((r) => {
                  const isEntree = r.type === "entree";
                  const expectedMin = toMinutes(computed.expectedStart) ?? 510;
                  const m = toMinutes(r.heure);
                  const lateMin = isEntree && m !== null && m > expectedMin ? m - expectedMin : 0;
                  const status = lateMin > 0 ? `Retard ${lateMin} min` : "Normal";
                  return (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium">{r.date.split("-").reverse().join("/")}</td>
                      <td className="py-3 pr-4">{r.heure}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={
                            isEntree
                              ? "inline-flex rounded-full border bg-[color-mix(in_oklch,var(--success)_18%,transparent)] px-3 py-1 text-xs font-medium"
                              : "inline-flex rounded-full border bg-[color-mix(in_oklch,var(--destructive)_12%,transparent)] px-3 py-1 text-xs font-medium"
                          }
                        >
                          {isEntree ? "Entrée" : "Sortie"}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {typeof r.latitude === "number" && typeof r.longitude === "number"
                          ? `${r.latitude.toFixed(4)}°, ${r.longitude.toFixed(4)}°`
                          : "—"}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={
                            lateMin > 0
                              ? "inline-flex rounded-full border bg-[color-mix(in_oklch,var(--warning)_18%,transparent)] px-3 py-1 text-xs font-medium"
                              : "inline-flex rounded-full border bg-[color-mix(in_oklch,var(--success)_18%,transparent)] px-3 py-1 text-xs font-medium"
                          }
                        >
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!loading && viewRows.length === 0 ? (
                  <tr>
                    <td className="py-6 text-muted-foreground" colSpan={5}>
                      Aucun pointage pour le moment.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

