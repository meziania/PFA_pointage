"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveTableWrap } from "@/components/ui/responsive-table-wrap";
import type { AnomalyRow } from "@/lib/pointage-analytics";
import { WORK_RULES } from "@/lib/pointage-analytics";

type Props = {
  anomalies: AnomalyRow[];
  loading?: boolean;
  renderUser: (userId: string) => ReactNode;
};

export function PresenceAnomaliesPanel({ anomalies, loading, renderUser }: Props) {
  const [kindFilter, setKindFilter] = useState<string>("all");

  const kinds = useMemo(() => {
    const set = new Set(anomalies.map((a) => a.kind));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [anomalies]);

  const filtered = useMemo(() => {
    if (kindFilter === "all") return anomalies;
    return anomalies.filter((a) => a.kind === kindFilter);
  }, [anomalies, kindFilter]);

  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of anomalies) counts[a.kind] = (counts[a.kind] ?? 0) + 1;
    return counts;
  }, [anomalies]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Object.entries(summary).map(([kind, count]) => (
          <button
            key={kind}
            type="button"
            onClick={() => setKindFilter(kindFilter === kind ? "all" : kind)}
            className="admin-kpi text-left transition-opacity hover:opacity-90"
          >
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{kind}</div>
            <div className="mt-1 font-heading text-2xl tabular-data text-brand-dark">{count}</div>
          </button>
        ))}
        {!Object.keys(summary).length && !loading ? (
          <div className="admin-kpi col-span-full">
            <div className="text-sm text-muted-foreground">Aucune anomalie sur la période filtrée.</div>
          </div>
        ) : null}
      </div>

      <Card className="border-brand/15">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Détail des anomalies</CardTitle>
          <CardDescription className="text-xs">
            Règles : entrée {WORK_RULES.expectedStart}, sortie {WORK_RULES.expectedEnd}, minimum {WORK_RULES.minHours} h
            — absences exclues si congé validé.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" size="sm" variant={kindFilter === "all" ? "default" : "outline"} onClick={() => setKindFilter("all")}>
              Toutes ({anomalies.length})
            </Button>
            {kinds.map((k) => (
              <Button
                key={k}
                type="button"
                size="sm"
                variant={kindFilter === k ? "default" : "outline"}
                onClick={() => setKindFilter(k)}
              >
                {k}
              </Button>
            ))}
          </div>

          <div className="space-y-3 md:hidden">
            {filtered.map((a) => (
              <div key={`${a.key}|${a.kind}`} className="mobile-data-card">
                <div>{renderUser(a.userId)}</div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-brand-dark">{a.kind}</span>
                  <span className="text-muted-foreground">{a.date}</span>
                </div>
                {a.details ? <p className="mt-1 text-xs text-muted-foreground">{a.details}</p> : null}
              </div>
            ))}
            {!loading && filtered.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground">Aucune anomalie pour ce filtre.</p>
            ) : null}
          </div>

          <ResponsiveTableWrap className="hidden md:block">
            <div className="max-h-[480px] overflow-auto rounded-lg border border-brand/10">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-3 py-2.5">Employé</th>
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Anomalie</th>
                    <th className="px-3 py-2.5">Détails</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    <tr key={`${a.key}|${a.kind}`} className="border-b last:border-0 hover:bg-brand-light/30">
                      <td className="px-3 py-2.5">{renderUser(a.userId)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap tabular-data">{a.date}</td>
                      <td className="px-3 py-2.5">{a.kind}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{a.details}</td>
                    </tr>
                  ))}
                  {!loading && filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                        Aucune anomalie pour ce filtre.
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
