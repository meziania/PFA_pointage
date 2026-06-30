"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  Percent,
  RefreshCw,
  UserCheck,
  UserMinus,
  Users,
} from "lucide-react";
import { collection, getCountFromServer, getDocs, limit, query, where } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { getFirebaseFirestore } from "@/lib/firebase-firestore";
import { listPointages } from "@/lib/firestore-helpers";
import { fetchAdminJournal, type JournalPresenceMode } from "@/lib/admin-journal-client";
import { moroccoYmdDaysAgo } from "@/lib/pointage-time";
import type { CongeDoc, JournalPresenceDoc, UserDoc } from "@/lib/data-model";
import {
  buildHolidayDateSet,
  buildLeaveKeys,
  computeDailyHours,
  computePresenceRateToday,
  computeTodayPresenceBoard,
  detectAnomalies,
  detectScheduledAbsences,
  enumerateYmdRange,
  filterPointages,
  lastNDaysYmd,
  mergeAnomalies,
  todayYmd,
  usersOnLeaveForDate,
  type CongeMini,
  type EmployeeMini,
  type PointageRow,
} from "@/lib/pointage-analytics";
import { DashboardSectionNav, type DashboardSection } from "@/components/admin/dashboard/dashboard-section-nav";
import { PresenceKpiStrip, type KpiItem } from "@/components/admin/dashboard/presence-kpi-strip";
import { PresenceTodayBoard } from "@/components/admin/dashboard/presence-today-board";
import { PresenceJournalPanel } from "@/components/admin/dashboard/presence-journal-panel";
import { PresenceChartsPanel } from "@/components/admin/dashboard/presence-charts-panel";
import { PresenceAnomaliesPanel } from "@/components/admin/dashboard/presence-anomalies-panel";
import type { PeriodPreset } from "@/components/admin/dashboard/presence-journal-panel";
import { apiErrorMessage } from "@/lib/user-management";

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

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<DashboardSection>("today");
  const [rows, setRows] = useState<PointageRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeMini[]>([]);
  const [conges, setConges] = useState<CongeMini[]>([]);
  const [congesPending, setCongesPending] = useState(0);
  const [congesByStatus, setCongesByStatus] = useState<CongeSlice[]>([
    { key: "en_attente", label: "En attente", value: 0, color: "#633806" },
    { key: "valide", label: "Validé", value: 0, color: "#0f6e56" },
    { key: "refuse", label: "Refusé", value: 0, color: "#791f1f" },
  ]);
  const [hoursByDay, setHoursByDay] = useState<HoursDayRow[]>([]);

  const [filterMode, setFilterMode] = useState<"day" | "range">("range");
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(() => todayYmd());
  const [dateDebut, setDateDebut] = useState(() => moroccoYmdDaysAgo(30));
  const [dateFin, setDateFin] = useState(() => todayYmd());
  const [journalView, setJournalView] = useState<JournalPresenceMode>("presence");
  const [journalRows, setJournalRows] = useState<Array<JournalPresenceDoc & { id: string }>>([]);
  const [journalPointages, setJournalPointages] = useState<PointageRow[]>([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalLoaded, setJournalLoaded] = useState(false);

  const today = todayYmd();
  const todayLabel = format(new Date(), "EEEE d MMMM yyyy", { locale: fr });

  async function loadData() {
    const db = getFirebaseFirestore();
    if (!db) {
      toast.error("Firestore non configuré");
      return;
    }

    setLoading(true);
    try {
      const [pointages, usersSnap, congesSnap, congesPendingSnap, congesValideSnap, congesRefuseSnap] =
        await Promise.all([
          listPointages(800),
          getDocs(query(collection(db, "users"), limit(500))),
          getDocs(query(collection(db, "conges"), limit(300))),
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
          departement: data.departement,
        };
      });
      usersList.sort((a, b) => a.nom.localeCompare(b.nom));

      const congesList: CongeMini[] = congesSnap.docs.map((d) => {
        const data = d.data() as CongeDoc;
        return {
          userId: data.userId,
          dateDebut: data.dateDebut,
          dateFin: data.dateFin,
          statut: data.statut,
        };
      });

      const days = lastNDaysYmd(7);
      setHoursByDay(
        days.map((ymd) => ({
          day: ymd.slice(5),
          heures: computeDailyHours(pointages, ymd),
        })),
      );

      setRows(pointages);
      setEmployees(usersList);
      setConges(congesList);
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

  function resolveJournalRange(): { from: string; to: string } {
    if (filterMode === "day" && date.trim()) {
      return { from: date.trim(), to: date.trim() };
    }
    const from = dateDebut.trim() || moroccoYmdDaysAgo(30);
    const to = dateFin.trim() || todayYmd();
    return { from, to };
  }

  async function loadJournal(override?: { from?: string; to?: string; mode?: JournalPresenceMode }) {
    const range = resolveJournalRange();
    const from = override?.from ?? range.from;
    const to = override?.to ?? range.to;
    const mode = override?.mode ?? journalView;
    setJournalLoading(true);
    try {
      const res = await fetchAdminJournal({
        from,
        to,
        userId: employeeId.trim() || undefined,
        mode,
      });
      if (res.mode === "presence") {
        setJournalRows(res.journal);
      } else {
        setJournalPointages(res.pointages as PointageRow[]);
      }
      setJournalLoaded(true);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Impossible de charger le journal."));
    } finally {
      setJournalLoading(false);
    }
  }

  function applyJournalPreset(preset: PeriodPreset) {
    const today = todayYmd();
    if (preset === "today") {
      setFilterMode("day");
      setDate(today);
      void loadJournal({ from: today, to: today });
      return;
    }
    setFilterMode("range");
    setDateFin(today);
    const from =
      preset === "7d" ? moroccoYmdDaysAgo(7) : preset === "30d" ? moroccoYmdDaysAgo(30) : `${today.slice(0, 7)}-01`;
    setDateDebut(from);
    void loadJournal({ from, to: today });
  }

  function handleJournalViewChange(mode: JournalPresenceMode) {
    setJournalView(mode);
    if (journalLoaded) void loadJournal({ mode });
  }

  useEffect(() => {
    if (section !== "journal" || journalLoaded) return;
    queueMicrotask(() => void loadJournal());
  }, [section, journalLoaded]);

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.role === "employe" && (e.statut ?? "actif") === "actif"),
    [employees],
  );

  const onLeaveToday = useMemo(() => usersOnLeaveForDate(conges, today), [conges, today]);

  const presenceBoard = useMemo(
    () => computeTodayPresenceBoard(activeEmployees, rows, today, onLeaveToday),
    [activeEmployees, onLeaveToday, rows, today],
  );

  const presenceRate = useMemo(() => computePresenceRateToday(presenceBoard), [presenceBoard]);

  const userById = useMemo(() => {
    const map = new Map<string, EmployeeMini>();
    for (const u of employees) map.set(u.id, u);
    return map;
  }, [employees]);

  const filtered = useMemo(
    () => filterPointages(rows, { employeeId, filterMode, date, dateDebut, dateFin }),
    [rows, employeeId, filterMode, date, dateDebut, dateFin],
  );

  const filteredDates = useMemo(() => [...new Set(filtered.map((r) => r.date))], [filtered]);

  const anomalyDates = useMemo(() => {
    if (filterMode === "day" && date.trim()) return [date.trim()];
    if (filterMode === "range") {
      const start = dateDebut.trim();
      const end = dateFin.trim();
      if (start && end) return enumerateYmdRange(start, end);
      if (start) return [start];
    }
    return filteredDates.length ? filteredDates : lastNDaysYmd(7);
  }, [date, dateDebut, dateFin, filterMode, filteredDates]);

  const holidayDates = useMemo(() => buildHolidayDateSet(anomalyDates), [anomalyDates]);

  const leaveKeys = useMemo(() => buildLeaveKeys(conges, anomalyDates), [conges, anomalyDates]);

  const anomalies = useMemo(() => {
    const pointageAnomalies = detectAnomalies(filtered, { skipAbsenceKeys: leaveKeys });
    const scheduled = detectScheduledAbsences(activeEmployees, anomalyDates, filtered, conges, { holidayDates });
    return mergeAnomalies(pointageAnomalies, scheduled);
  }, [activeEmployees, anomalyDates, conges, filtered, holidayDates, leaveKeys]);

  const boardStats = useMemo(() => {
    const stats = {
      present: 0,
      retard: 0,
      sorti: 0,
      absent: 0,
      en_conge: 0,
    };
    for (const row of presenceBoard) stats[row.status] += 1;
    return stats;
  }, [presenceBoard]);

  const kpis: KpiItem[] = useMemo(
    () => [
      {
        label: "Employés actifs",
        value: String(activeEmployees.length),
        icon: Users,
        tone: "default",
      },
      {
        label: "Sur site",
        value: String(boardStats.present + boardStats.retard),
        hint: `${boardStats.retard} retard(s)`,
        icon: UserCheck,
        tone: "success",
      },
      {
        label: "Absents",
        value: String(boardStats.absent),
        icon: UserMinus,
        tone: boardStats.absent > 0 ? "danger" : "muted",
      },
      {
        label: "En congé",
        value: String(boardStats.en_conge),
        icon: CalendarClock,
        tone: "muted",
      },
      {
        label: "Taux présence",
        value: `${presenceRate} %`,
        hint: "Hors congés validés",
        icon: Percent,
        tone: presenceRate >= 80 ? "success" : presenceRate >= 60 ? "warning" : "danger",
      },
      {
        label: "Anomalies",
        value: String(anomalies.length),
        hint: "Période filtrée",
        icon: AlertTriangle,
        tone: anomalies.length > 0 ? "warning" : "muted",
      },
    ],
    [activeEmployees.length, anomalies.length, boardStats, presenceRate],
  );

  function renderUserCell(uid: string) {
    const u = userById.get(uid);
    return (
      <div className="min-w-[160px] max-w-[280px]" title={u?.email ? `${u.nom} · ${u.email}` : u?.nom ?? ""}>
        <div className="truncate font-medium">{u?.nom ?? "Utilisateur inconnu"}</div>
        {u?.email ? <div className="truncate text-xs text-muted-foreground">{u.email}</div> : null}
      </div>
    );
  }

  function exportCsv() {
    if (journalView === "presence") {
      const header = ["userNom", "userEmail", "date", "statut", "entree", "sortie", "heures", "pointagesCount"];
      const lines = journalRows.map((r) => {
        const u = userById.get(r.userId);
        return [
          u?.nom ?? "",
          u?.email ?? "",
          r.date,
          r.statut,
          r.entree ?? "",
          r.sortie ?? "",
          r.heures != null ? String(r.heures) : "",
          String(r.pointagesCount),
        ];
      });
      const csv = [header, ...lines].map((row) => row.map(csvEscape).join(",")).join("\n");
      downloadText(`journal-presence-${todayYmd()}.csv`, csv, "text/csv;charset=utf-8");
      toast.success("Export CSV généré");
      return;
    }

    const header = ["userNom", "userEmail", "date", "heure", "type", "latitude", "longitude", "valide"];
    const lines = journalPointages.map((r) => {
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
    downloadText(`journal-pointages-${todayYmd()}.csv`, csv, "text/csv;charset=utf-8");
    toast.success("Export CSV généré");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Présence &amp; pointage</h1>
          <p className="page-subtitle">
            Consultation RH — {todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1)}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}>
          <RefreshCw className={`mr-1.5 size-4 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      <PresenceKpiStrip items={kpis} loading={loading} />

      <DashboardSectionNav
        active={section}
        onChange={setSection}
        counts={{
          today: boardStats.absent + boardStats.retard,
          anomalies: anomalies.length,
        }}
      />

      {section === "today" ? (
        <PresenceTodayBoard
          board={presenceBoard}
          employees={activeEmployees}
          loading={loading}
          dateLabel={todayLabel}
          renderUser={renderUserCell}
        />
      ) : null}

      {section === "journal" ? (
        <PresenceJournalPanel
          loading={loading}
          journalLoading={journalLoading}
          journalView={journalView}
          onJournalViewChange={handleJournalViewChange}
          onLoadJournal={() => void loadJournal()}
          onApplyPreset={applyJournalPreset}
          filtered={journalPointages}
          journalRows={journalRows}
          employeeOptions={activeEmployees}
          employeeId={employeeId}
          onEmployeeIdChange={setEmployeeId}
          filterMode={filterMode}
          onFilterModeChange={setFilterMode}
          date={date}
          onDateChange={setDate}
          dateDebut={dateDebut}
          onDateDebutChange={setDateDebut}
          dateFin={dateFin}
          onDateFinChange={setDateFin}
          onExport={exportCsv}
          renderUser={renderUserCell}
        />
      ) : null}

      {section === "analytics" ? (
        <PresenceChartsPanel hoursByDay={hoursByDay} congesByStatus={congesByStatus} />
      ) : null}

      {section === "anomalies" ? (
        <PresenceAnomaliesPanel anomalies={anomalies} loading={loading} renderUser={renderUserCell} />
      ) : null}

      {section === "today" && congesPending > 0 ? (
        <p className="rounded-lg border border-status-pending-text/20 bg-status-pending-bg px-3 py-2 text-sm text-status-pending-text">
          {congesPending} demande(s) de congé en attente de validation — consultez la section Congés.
        </p>
      ) : null}
    </div>
  );
}
