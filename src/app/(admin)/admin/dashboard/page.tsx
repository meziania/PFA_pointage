"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { collection, getCountFromServer, getDocs, limit, query, where } from "firebase/firestore";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getFirebaseFirestore } from "@/lib/firebase-firestore";
import { listPointages } from "@/lib/firestore-helpers";
import type { PointageDoc, UserDoc } from "@/lib/data-model";
import {
  computeAttendanceToday,
  computeDailyHours,
  detectAnomalies,
  filterPointages,
  lastNDaysYmd,
  todayYmd,
  type EmployeeMini,
  type PointageRow,
} from "@/lib/pointage-analytics";
import { StatusBadge, congeStatutVariant } from "@/components/ui/status-badge";

type CongeStatusKey = "en_attente" | "valide" | "refuse";
type CongeSlice = { key: CongeStatusKey; label: string; value: number; color: string };
type HoursDayRow = { day: string; heures: number };

function csvEscape(v: string): string {
  const s = v ?? "";
  if (/[",\n]/.test(s)) return `"${s.replaceAll("\"", "\"\"")}"`;
  return s;
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

function formatPointageType(type: PointageDoc["type"]): string {
  return type === "entree" ? "Entrée" : "Sortie";
}

function HoursTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value ?? 0;
  return (
    <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-sm">
      <div className="font-medium">{label}</div>
      <div className="text-muted-foreground">{v} h travaillées</div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PointageRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeMini[]>([]);
  const [congesPending, setCongesPending] = useState(0);
  const [congesByStatus, setCongesByStatus] = useState<CongeSlice[]>([
    { key: "en_attente", label: "En attente", value: 0, color: "#633806" },
    { key: "valide", label: "Validé", value: 0, color: "#0f6e56" },
    { key: "refuse", label: "Refusé", value: 0, color: "#791f1f" },
  ]);
  const [hoursByDay, setHoursByDay] = useState<HoursDayRow[]>([]);

  const [filterMode, setFilterMode] = useState<"day" | "range">("day");
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(() => todayYmd());
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");

  async function loadData() {
    const db = getFirebaseFirestore();
    if (!db) {
      toast.error("Firestore non configuré");
      return;
    }

    setLoading(true);
    try {
      const [pointages, usersSnap, congesPendingSnap, congesValideSnap, congesRefuseSnap] = await Promise.all([
        listPointages(500),
        getDocs(query(collection(db, "users"), limit(500))),
        getCountFromServer(query(collection(db, "conges"), where("statut", "==", "en_attente"))),
        getCountFromServer(query(collection(db, "conges"), where("statut", "==", "valide"))),
        getCountFromServer(query(collection(db, "conges"), where("statut", "==", "refuse"))),
      ]);

      const usersList: EmployeeMini[] = usersSnap.docs.map((d) => {
        const data = d.data() as Partial<UserDoc>;
        return {
          id: d.id,
          nom: data.nom ?? "(sans nom)",
          email: data.email ?? "",
          role: data.role === "admin" || data.role === "employe" ? data.role : "employe",
          statut: data.statut ?? "actif",
        };
      });
      usersList.sort((a, b) => a.nom.localeCompare(b.nom));

      const days = lastNDaysYmd(7);
      setHoursByDay(
        days.map((ymd) => ({
          day: ymd.slice(5),
          heures: computeDailyHours(pointages, ymd),
        })),
      );

      setRows(pointages);
      setEmployees(usersList);
      setCongesPending(congesPendingSnap.data().count);
      setCongesByStatus((prev) => [
        { ...prev[0], value: congesPendingSnap.data().count },
        { ...prev[1], value: congesValideSnap.data().count },
        { ...prev[2], value: congesRefuseSnap.data().count },
      ]);
    } catch {
      toast.error("Impossible de charger le dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => void loadData());
  }, []);

  const activeEmployees = useMemo(() => employees.filter((e) => e.role === "employe" && (e.statut ?? "actif") === "actif"), [employees]);

  const attendanceToday = useMemo(
    () => computeAttendanceToday(activeEmployees, rows, todayYmd()),
    [activeEmployees, rows],
  );

  const employeeOptions = useMemo(() => activeEmployees, [activeEmployees]);

  const userById = useMemo(() => {
    const map = new Map<string, EmployeeMini>();
    for (const u of employees) map.set(u.id, u);
    return map;
  }, [employees]);

  const filtered = useMemo(
    () => filterPointages(rows, { employeeId, filterMode, date, dateDebut, dateFin }),
    [rows, employeeId, filterMode, date, dateDebut, dateFin],
  );

  const anomalies = useMemo(() => detectAnomalies(filtered), [filtered]);

  const kpis = useMemo(
    () => [
      { label: "Employés actifs", value: loading ? "…" : String(attendanceToday.total) },
      { label: "Présents aujourd'hui", value: loading ? "…" : String(attendanceToday.present) },
      { label: "Absents aujourd'hui", value: loading ? "…" : String(attendanceToday.absent) },
      { label: "Congés en attente", value: loading ? "…" : String(congesPending) },
    ],
    [attendanceToday, congesPending, loading],
  );

  function renderUserCell(uid: string) {
    const u = userById.get(uid);
    return (
      <div className="min-w-[180px] max-w-[320px]" title={u?.email ? `${u.nom} · ${u.email}` : u?.nom ?? ""}>
        <div className="truncate font-medium">{u?.nom ?? "Utilisateur inconnu"}</div>
        {u?.email ? <div className="truncate text-xs text-muted-foreground">{u.email}</div> : null}
      </div>
    );
  }

  function exportCsv() {
    const header = ["userNom", "userEmail", "date", "heure", "type", "latitude", "longitude", "valide"];
    const lines = filtered.map((r) => {
      const u = userById.get(r.userId);
      return [
        u?.nom ?? "",
        u?.email ?? "",
        r.date,
        r.heure,
        r.type,
        typeof r.latitude === "number" ? String(r.latitude) : "",
        typeof r.longitude === "number" ? String(r.longitude) : "",
        String(Boolean(r.valide)),
      ];
    });
    const csv = [header, ...lines].map((row) => row.map(csvEscape).join(",")).join("\n");
    downloadText(`dashboard-pointages-${todayYmd()}.csv`, csv, "text/csv;charset=utf-8");
    toast.success("Export CSV généré");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-xl text-brand-dark md:text-2xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Présence, heures, congés et anomalies — vue dense.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}>
          {loading ? "…" : "Actualiser"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="admin-kpi">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k.label}</div>
            <div className="mt-1 font-heading text-2xl tabular-data text-brand-dark md:text-3xl">{k.value}</div>
          </div>
        ))}
      </div>

      <Card className="border-brand/15">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtres pointages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <div className="mb-1 text-xs text-muted-foreground">Employé</div>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                disabled={loading}
              >
                <option value="">Tous</option>
                {employeeOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nom}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="mb-1 text-xs text-muted-foreground">Mode</div>
              <div className="flex gap-1">
                <Button type="button" size="sm" variant={filterMode === "day" ? "default" : "outline"} onClick={() => setFilterMode("day")}>
                  Jour
                </Button>
                <Button type="button" size="sm" variant={filterMode === "range" ? "default" : "outline"} onClick={() => setFilterMode("range")}>
                  Période
                </Button>
              </div>
            </div>
            <div>
              {filterMode === "day" ? (
                <>
                  <div className="mb-1 text-xs text-muted-foreground">Date</div>
                  <Input type="date" className="h-9" value={date} onChange={(e) => setDate(e.target.value)} />
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="mb-1 text-xs text-muted-foreground">Début</div>
                    <Input type="date" className="h-9" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
                  </div>
                  <div>
                    <div className="mb-1 text-xs text-muted-foreground">Fin</div>
                    <Input type="date" className="h-9" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="border-brand/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Heures travaillées (7 j)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hoursByDay} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <Tooltip content={<HoursTooltip />} />
                  <Bar dataKey="heures" fill="#0f6e56" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-brand/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Congés par statut</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-[180px_1fr]">
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip />
                    <Pie
                      data={congesByStatus}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={50}
                      outerRadius={78}
                      paddingAngle={2}
                      stroke="var(--card)"
                      strokeWidth={2}
                    >
                      {congesByStatus.map((s) => (
                        <Cell key={s.key} fill={s.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 text-sm">
                {congesByStatus.map((s) => (
                  <div key={s.key} className="flex items-center justify-between rounded-md border border-border px-2.5 py-1.5">
                    <StatusBadge variant={congeStatutVariant(s.key)}>{s.label}</StatusBadge>
                    <span className="tabular-data font-medium">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="border-brand/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pointages</CardTitle>
            <CardDescription className="text-xs">{`${filtered.length} ligne(s)`}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 md:hidden">
              {filtered.map((r) => (
                <div key={r.id} className="mobile-data-card">
                  <div>{renderUserCell(r.userId)}</div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{r.date} · {r.heure}</span>
                    <span className="font-medium text-foreground">{formatPointageType(r.type)}</span>
                  </div>
                </div>
              ))}
              {!loading && filtered.length === 0 ? (
                <p className="py-6 text-center text-muted-foreground">Aucune donnée pour ces filtres.</p>
              ) : null}
            </div>
            <div className="hidden max-h-[380px] overflow-auto md:block">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-4">Employé</th>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Heure</th>
                    <th className="py-2 pr-4">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">{renderUserCell(r.userId)}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">{r.date}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">{r.heure}</td>
                      <td className="py-2 pr-4">{formatPointageType(r.type)}</td>
                    </tr>
                  ))}
                  {!loading && filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-muted-foreground">
                        Aucune donnée pour ces filtres.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-brand/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Anomalies</CardTitle>
            <CardDescription className="text-xs">Retards, absences, &lt; 8 h</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 md:hidden">
              {anomalies.map((a) => (
                <div key={`${a.key}|${a.kind}`} className="mobile-data-card">
                  <div>{renderUserCell(a.userId)}</div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-brand-dark">{a.kind}</span>
                    <span className="text-muted-foreground">{a.date}</span>
                  </div>
                  {a.details ? <p className="mt-1 text-xs text-muted-foreground">{a.details}</p> : null}
                </div>
              ))}
              {!loading && anomalies.length === 0 ? (
                <p className="py-6 text-center text-muted-foreground">Aucune anomalie détectée.</p>
              ) : null}
            </div>
            <div className="hidden max-h-[380px] overflow-auto md:block">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-4">Employé</th>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Anomalie</th>
                    <th className="py-2 pr-4">Détails</th>
                  </tr>
                </thead>
                <tbody>
                  {anomalies.map((a) => (
                    <tr key={`${a.key}|${a.kind}`} className="border-b last:border-0">
                      <td className="py-2 pr-4">{renderUserCell(a.userId)}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">{a.date}</td>
                      <td className="py-2 pr-4">{a.kind}</td>
                      <td className="py-2 pr-4">{a.details}</td>
                    </tr>
                  ))}
                  {!loading && anomalies.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-muted-foreground">
                        Aucune anomalie détectée.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
