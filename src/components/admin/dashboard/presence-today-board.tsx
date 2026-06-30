"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ResponsiveTableWrap } from "@/components/ui/responsive-table-wrap";
import { StatusBadge, presenceStatusVariant } from "@/components/ui/status-badge";
import type { EmployeeMini, PresenceBoardRow, PresenceDayStatus } from "@/lib/pointage-analytics";
import { PRESENCE_STATUS_LABELS } from "@/lib/pointage-analytics";

type StatusFilter = "all" | PresenceDayStatus;

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "present", label: "Présents" },
  { key: "retard", label: "Retards" },
  { key: "sorti", label: "Partis" },
  { key: "absent", label: "Absents" },
  { key: "en_conge", label: "Congés" },
];

type Props = {
  board: PresenceBoardRow[];
  employees: EmployeeMini[];
  loading?: boolean;
  dateLabel: string;
  renderUser: (userId: string) => ReactNode;
};

export function PresenceTodayBoard({ board, employees, loading, dateLabel, renderUser }: Props) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [deptFilter, setDeptFilter] = useState("");

  const userById = useMemo(() => {
    const map = new Map<string, EmployeeMini>();
    for (const e of employees) map.set(e.id, e);
    return map;
  }, [employees]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const e of employees) {
      const d = e.departement?.trim();
      if (d) set.add(d);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [employees]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return board.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      const u = userById.get(row.userId);
      if (deptFilter && (u?.departement ?? "") !== deptFilter) return false;
      if (!q) return true;
      const hay = `${u?.nom ?? ""} ${u?.email ?? ""} ${u?.departement ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [board, deptFilter, query, statusFilter, userById]);

  return (
    <Card className="border-brand/15">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Présence du jour</CardTitle>
        <CardDescription className="text-xs">
          {dateLabel} — {loading ? "…" : `${filtered.length} employé(s) affiché(s)`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 pl-9"
              placeholder="Rechercher un employé…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {departments.length ? (
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm lg:w-44"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              <option value="">Tous départements</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.key}
              type="button"
              size="sm"
              variant={statusFilter === f.key ? "default" : "outline"}
              onClick={() => setStatusFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        <div className="space-y-3 md:hidden">
          {filtered.map((row) => (
            <div key={row.userId} className="mobile-data-card">
              <div className="flex items-start justify-between gap-2">
                {renderUser(row.userId)}
                <StatusBadge variant={presenceStatusVariant(row.status)}>
                  {PRESENCE_STATUS_LABELS[row.status]}
                </StatusBadge>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span>Entrée : {row.entree ?? "—"}</span>
                <span>Sortie : {row.sortie ?? "—"}</span>
                <span>Heures : {row.heures != null ? `${row.heures} h` : "—"}</span>
                <span className="truncate">{row.details ?? "—"}</span>
              </div>
            </div>
          ))}
          {!loading && filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Aucun employé pour ces filtres.</p>
          ) : null}
        </div>

        <ResponsiveTableWrap className="hidden md:block">
          <div className="max-h-[420px] overflow-auto rounded-lg border border-brand/10">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-3 py-2.5">Employé</th>
                  <th className="px-3 py-2.5">Département</th>
                  <th className="px-3 py-2.5">Statut</th>
                  <th className="px-3 py-2.5">Entrée</th>
                  <th className="px-3 py-2.5">Sortie</th>
                  <th className="px-3 py-2.5">Heures</th>
                  <th className="px-3 py-2.5">Détails</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const u = userById.get(row.userId);
                  return (
                    <tr key={row.userId} className="border-b last:border-0 hover:bg-brand-light/30">
                      <td className="px-3 py-2.5">{renderUser(row.userId)}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{u?.departement ?? "—"}</td>
                      <td className="px-3 py-2.5">
                        <StatusBadge variant={presenceStatusVariant(row.status)}>
                          {PRESENCE_STATUS_LABELS[row.status]}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-2.5 tabular-data whitespace-nowrap">{row.entree ?? "—"}</td>
                      <td className="px-3 py-2.5 tabular-data whitespace-nowrap">{row.sortie ?? "—"}</td>
                      <td className="px-3 py-2.5 tabular-data">{row.heures != null ? `${row.heures} h` : "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{row.details ?? "—"}</td>
                    </tr>
                  );
                })}
                {!loading && filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                      Aucun employé pour ces filtres.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </ResponsiveTableWrap>
      </CardContent>
    </Card>
  );
}
