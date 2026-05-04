"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getCountFromServer, getDocs, query, where } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getFirebaseFirestore } from "@/lib/firebase-firestore";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PointageDoc } from "@/lib/data-model";

type Kpi = { label: string; value: string };
type DayRow = { day: string; pointages: number };
type CongeStatusKey = "en_attente" | "valide" | "refuse";
type CongeSlice = { key: CongeStatusKey; label: string; value: number; color: string };

function lastNDaysYmd(n: number): string[] {
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

function MiniTooltip({
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
      <div className="text-muted-foreground">{v} pointage(s)</div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<{ users: number; pointages: number; congesPending: number }>({
    users: 0,
    pointages: 0,
    congesPending: 0,
  });
  const [last7, setLast7] = useState<DayRow[]>([]);
  const [congesByStatus, setCongesByStatus] = useState<CongeSlice[]>([
    { key: "en_attente", label: "En attente", value: 0, color: "hsl(var(--primary))" },
    { key: "valide", label: "Validé", value: 0, color: "hsl(142 71% 45%)" },
    { key: "refuse", label: "Refusé", value: 0, color: "hsl(0 84% 60%)" },
  ]);

  useEffect(() => {
    const db = getFirebaseFirestore();
    if (!db) return;

    void (async () => {
      try {
        const users = await getCountFromServer(collection(db, "users"));
        const pointages = await getCountFromServer(collection(db, "pointages"));
        const congesPending = await getCountFromServer(query(collection(db, "conges"), where("statut", "==", "en_attente")));
        const congesValide = await getCountFromServer(query(collection(db, "conges"), where("statut", "==", "valide")));
        const congesRefuse = await getCountFromServer(query(collection(db, "conges"), where("statut", "==", "refuse")));

        // Graphique MVP: nombre de pointages par jour (7 derniers jours)
        const days = lastNDaysYmd(7);
        const countsByDay = new Map<string, number>(days.map((d) => [d, 0]));
        // On ne récupère que les 7 jours (in <= 10) pour éviter de scanner toute la collection.
        const snap = await getDocs(query(collection(db, "pointages"), where("date", "in", days)));
        for (const doc of snap.docs) {
          const p = doc.data() as Partial<PointageDoc>;
          const ymd = typeof p.date === "string" ? p.date : null;
          if (!ymd) continue;
          if (!countsByDay.has(ymd)) continue;
          countsByDay.set(ymd, (countsByDay.get(ymd) ?? 0) + 1);
        }
        setLast7(days.map((d) => ({ day: d.slice(5), pointages: countsByDay.get(d) ?? 0 })));
        setCongesByStatus((prev) => [
          { ...prev[0], value: congesPending.data().count },
          { ...prev[1], value: congesValide.data().count },
          { ...prev[2], value: congesRefuse.data().count },
        ]);

        setCounts({
          users: users.data().count,
          pointages: pointages.data().count,
          congesPending: congesPending.data().count,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const kpis = useMemo<Kpi[]>(
    () => [
      { label: "Employés", value: loading ? "…" : String(counts.users) },
      { label: "Pointages", value: loading ? "…" : String(counts.pointages) },
      { label: "Congés en attente", value: loading ? "…" : String(counts.congesPending) },
    ],
    [counts, loading],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Indicateurs globaux (MVP).</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsla(217,92%,60%,0.18),transparent_55%)]" />
          <CardHeader className="relative">
            <CardTitle>Pointages (7 jours)</CardTitle>
            <CardDescription>Tendance quotidienne des pointages.</CardDescription>
          </CardHeader>
          <CardContent className="relative space-y-3">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={last7} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pointagesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip content={<MiniTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="pointages"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#pointagesFill)"
                    dot={{ r: 2, strokeWidth: 0, fill: "hsl(var(--primary))" }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {loading ? <div className="text-xs text-muted-foreground">Chargement…</div> : null}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsla(142,71%,45%,0.14),transparent_55%)]" />
          <CardHeader className="relative">
            <CardTitle>Demandes de congés</CardTitle>
            <CardDescription>Répartition par statut (en attente / validé / refusé).</CardDescription>
          </CardHeader>
          <CardContent className="relative">
            <div className="grid gap-4 md:grid-cols-[260px_1fr]">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip />
                    <Pie
                      data={congesByStatus}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={58}
                      outerRadius={86}
                      paddingAngle={3}
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                    >
                      {congesByStatus.map((s) => (
                        <Cell key={s.key} fill={s.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3 text-sm">
                <div className="rounded-lg border bg-background/60 p-3">
                  <div className="text-xs text-muted-foreground">Total</div>
                  <div className="text-2xl font-bold">{congesByStatus.reduce((a, b) => a + b.value, 0)}</div>
                </div>
                <div className="space-y-2">
                  {congesByStatus.map((s) => (
                    <div key={s.key} className="flex items-center justify-between rounded-md border bg-background/60 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                        <span className="font-medium">{s.label}</span>
                      </div>
                      <span className="tabular-nums">{s.value}</span>
                    </div>
                  ))}
                </div>
                {loading ? <div className="text-xs text-muted-foreground">Chargement…</div> : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

