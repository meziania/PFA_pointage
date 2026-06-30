"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveTableWrap } from "@/components/ui/responsive-table-wrap";
import type { ReactNode } from "react";
import type { EmployeeMini, PointageRow } from "@/lib/pointage-analytics";
import type { PointageDoc } from "@/lib/data-model";

function formatPointageType(type: PointageDoc["type"]): string {
  return type === "entree" ? "Entrée" : "Sortie";
}

type Props = {
  loading?: boolean;
  filtered: PointageRow[];
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

export function PresenceJournalPanel({
  loading,
  filtered,
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
  return (
    <div className="space-y-3">
      <Card className="border-brand/15">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtres journal</CardTitle>
          <CardDescription className="text-xs">Consultez et exportez les pointages par employé ou période.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <div className="mb-1 text-xs text-muted-foreground">Employé</div>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={employeeId}
                onChange={(e) => onEmployeeIdChange(e.target.value)}
                disabled={loading}
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
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={onExport} disabled={filtered.length === 0}>
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-brand/15">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Journal des pointages</CardTitle>
          <CardDescription className="text-xs">{`${filtered.length} enregistrement(s)`}</CardDescription>
        </CardHeader>
        <CardContent>
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
                {r.valide === false ? (
                  <p className="mt-1 text-xs text-status-rejected-text">Hors zone géofence</p>
                ) : null}
              </div>
            ))}
            {!loading && filtered.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground">Aucune donnée pour ces filtres.</p>
            ) : null}
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
                    <th className="px-3 py-2.5">Zone</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-brand-light/30">
                      <td className="px-3 py-2.5">{renderUser(r.userId)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap tabular-data">{r.date}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap tabular-data">{r.heure}</td>
                      <td className="px-3 py-2.5">{formatPointageType(r.type)}</td>
                      <td className="px-3 py-2.5">
                        {r.valide === false ? (
                          <span className="text-xs font-medium text-status-rejected-text">Hors zone</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!loading && filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                        Aucune donnée pour ces filtres.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </ResponsiveTableWrap>
        </CardContent>
      </Card>
    </div>
  );
}
