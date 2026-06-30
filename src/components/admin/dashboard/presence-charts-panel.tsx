"use client";

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, congeStatutVariant } from "@/components/ui/status-badge";

type CongeSlice = { key: string; label: string; value: number; color: string };
type HoursDayRow = { day: string; heures: number };

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

export function PresenceChartsPanel({
  hoursByDay,
  congesByStatus,
}: {
  hoursByDay: HoursDayRow[];
  congesByStatus: CongeSlice[];
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card className="border-brand/15">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Heures travaillées — 7 derniers jours</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
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
            <div className="h-64 w-full">
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
  );
}
