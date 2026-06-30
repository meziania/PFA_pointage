"use client";

import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveTableWrap } from "@/components/ui/responsive-table-wrap";
import { StatusBadge, presenceStatusVariant } from "@/components/ui/status-badge";
import type { JournalPresenceDoc, PointageDoc } from "@/lib/data-model";
import type { EmployeeMini, PointageRow } from "@/lib/pointage-analytics";
import { PRESENCE_STATUS_LABELS } from "@/lib/pointage-analytics";
import type { JournalPresenceMode } from "@/lib/admin-journal-client";

function formatPointageType(type: PointageDoc["type"]): string {
  return type === "entree" ? "Entrée" : "Sortie";
}

type PeriodPreset = "today" | "7d" | "30d" | "month";

type Props = {
  loading?: boolean;
  journalLoading?: boolean;
  journalView: JournalPresenceMode;
  onJournalViewChange: (mode: JournalPresenceMode) => void;
  onLoadJournal: () => void;
  onApplyPreset: (preset: PeriodPreset) => void;
  filtered: PointageRow[];
  journalRows: Array<JournalPresenceDoc & { id: string }>;
  employeeOptions: EmployeeMini[];
  employeeId: string;
  onEmployeeIdChange: (v: string) => void;
  filterMode: "day" | "range";
  onFilterModeChange: (v: "day" | "range") => void;
  date: string;
  onDateChange: (v: string) => void;
  dateDebut: string;
  onDateDebutChange: (v: string) => void;
  dateFin: string;
  onDateFinChange: (v: string) => void;
  onExport: () => void;
  renderUser: (userId: string) => ReactNode;
};

const PRESETS: { key: PeriodPreset; label: string }[] = [
  { key: "today", label: "Aujourd'hui" },
  { key: "7d", label: "7 jours" },
  { key: "30d", label: "30 jours" },
  { key: "month", label: "Ce mois" },
];

export function PresenceJournalPanel({
  loading,
  journalLoading,
  journalView,
  onJournalViewChange,
  onLoadJournal,
  onApplyPreset,
  filtered,
  journalRows,
  employeeOptions,
  employeeId,
  onEmployeeIdChange,
  filterMode,
  onFilterModeChange,
  date,
  onDateChange,
  dateDebut,
  onDateDebutChange,
  dateFin,
  onDateFinChange,
  onExport,
  renderUser,
}: Props) {
  const displayCount = journalView === "presence" ? journalRows.length : filtered.length;
  const isEmpty = !journalLoading && displayCount === 0;

  return (
    <div className="space-y-3">
      <Card className="border-brand/15">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Journal présence &amp; pointage</CardTitle>
          <CardDescription className="text-xs">
            Consultez l&apos;historique sur plusieurs jours — les pointages sont journalisés automatiquement à chaque scan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <Button key={p.key} type="button" size="sm" variant="outline" onClick={() => onApplyPreset(p.key)}>
                {p.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <div className="mb-1 text-xs text-muted-foreground">Employé</div>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={employeeId}
                onChange={(e) => onEmployeeIdChange(e.target.value)}
                disabled={loading || journalLoading}
              >
                <option value="">Tous les employés</option>
                {employeeOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nom}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="mb-1 text-xs text-muted-foreground">Période</div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={filterMode === "day" ? "default" : "outline"}
                  onClick={() => onFilterModeChange("day")}
                >
                  Jour
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={filterMode === "range" ? "default" : "outline"}
                  onClick={() => onFilterModeChange("range")}
                >
                  Intervalle
                </Button>
              </div>
            </div>
            <div>
              {filterMode === "day" ? (
                <>
                  <div className="mb-1 text-xs text-muted-foreground">Date</div>
                  <Input type="date" className="h-9" value={date} onChange={(e) => onDateChange(e.target.value)} />
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="mb-1 text-xs text-muted-foreground">Début</div>
                    <Input type="date" className="h-9" value={dateDebut} onChange={(e) => onDateDebutChange(e.target.value)} />
                  </div>
                  <div>
                    <div className="mb-1 text-xs text-muted-foreground">Fin</div>
                    <Input type="date" className="h-9" value={dateFin} onChange={(e) => onDateFinChange(e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                variant={journalView === "presence" ? "default" : "outline"}
                onClick={() => onJournalViewChange("presence")}
              >
                Résumé présence
              </Button>
              <Button
                type="button"
                size="sm"
                variant={journalView === "pointages" ? "default" : "outline"}
                onClick={() => onJournalViewChange("pointages")}
              >
                Détail pointages
              </Button>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={onLoadJournal} disabled={journalLoading}>
                <Search className="mr-1.5 size-4" />
                {journalLoading ? "Chargement…" : "Consulter"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={onExport} disabled={displayCount === 0}>
                Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-brand/15">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {journalView === "presence" ? "Journal de présence" : "Journal des pointages"}
          </CardTitle>
          <CardDescription className="text-xs">{`${displayCount} enregistrement(s)`}</CardDescription>
        </CardHeader>
        <CardContent>
          {journalView === "presence" ? (
            <>
              <div className="space-y-3 md:hidden">
                {journalRows.map((row) => (
                  <div key={row.id} className="mobile-data-card">
                    <div className="flex items-start justify-between gap-2">
                      {renderUser(row.userId)}
                      <StatusBadge variant={presenceStatusVariant(row.statut)}>{PRESENCE_STATUS_LABELS[row.statut]}</StatusBadge>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <span>Date : {row.date}</span>
                      <span>Entrée : {row.entree ?? "—"}</span>
                      <span>Sortie : {row.sortie ?? "—"}</span>
                      <span>Heures : {row.heures != null ? `${row.heures} h` : "—"}</span>
                    </div>
                  </div>
                ))}
                {isEmpty ? <p className="py-6 text-center text-muted-foreground">Aucune donnée — choisissez une période et cliquez Consulter.</p> : null}
              </div>
              <ResponsiveTableWrap className="hidden md:block">
                <div className="max-h-[480px] overflow-auto rounded-lg border border-brand/10">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
                      <tr className="border-b">
                        <th className="px-3 py-2.5">Employé</th>
                        <th className="px-3 py-2.5">Date</th>
                        <th className="px-3 py-2.5">Statut</th>
                        <th className="px-3 py-2.5">Entrée</th>
                        <th className="px-3 py-2.5">Sortie</th>
                        <th className="px-3 py-2.5">Heures</th>
                        <th className="px-3 py-2.5">Scans</th>
                      </tr>
                    </thead>
                    <tbody>
                      {journalRows.map((row) => (
                        <tr key={row.id} className="border-b last:border-0 hover:bg-brand-light/30">
                          <td className="px-3 py-2.5">{renderUser(row.userId)}</td>
                          <td className="px-3 py-2.5 tabular-data whitespace-nowrap">{row.date}</td>
                          <td className="px-3 py-2.5">
                            <StatusBadge variant={presenceStatusVariant(row.statut)}>{PRESENCE_STATUS_LABELS[row.statut]}</StatusBadge>
                          </td>
                          <td className="px-3 py-2.5 tabular-data">{row.entree ?? "—"}</td>
                          <td className="px-3 py-2.5 tabular-data">{row.sortie ?? "—"}</td>
                          <td className="px-3 py-2.5 tabular-data">{row.heures != null ? `${row.heures} h` : "—"}</td>
                          <td className="px-3 py-2.5 tabular-data">{row.pointagesCount}</td>
                        </tr>
                      ))}
                      {isEmpty ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                            Aucune donnée — choisissez une période et cliquez Consulter.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </ResponsiveTableWrap>
            </>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {filtered.map((r) => (
                  <div key={r.id} className="mobile-data-card">
                    <div>{renderUser(r.userId)}</div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        {r.date} · {r.heure}
                      </span>
                      <span className="font-medium text-foreground">{formatPointageType(r.type)}</span>
                    </div>
                  </div>
                ))}
                {isEmpty ? <p className="py-6 text-center text-muted-foreground">Aucune donnée pour cette période.</p> : null}
              </div>
              <ResponsiveTableWrap className="hidden md:block">
                <div className="max-h-[480px] overflow-auto rounded-lg border border-brand/10">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
                      <tr className="border-b">
                        <th className="px-3 py-2.5">Employé</th>
                        <th className="px-3 py-2.5">Date</th>
                        <th className="px-3 py-2.5">Heure</th>
                        <th className="px-3 py-2.5">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r) => (
                        <tr key={r.id} className="border-b last:border-0 hover:bg-brand-light/30">
                          <td className="px-3 py-2.5">{renderUser(r.userId)}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap tabular-data">{r.date}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap tabular-data">{r.heure}</td>
                          <td className="px-3 py-2.5">{formatPointageType(r.type)}</td>
                        </tr>
                      ))}
                      {isEmpty ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                            Aucune donnée pour cette période.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </ResponsiveTableWrap>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export type { PeriodPreset };
