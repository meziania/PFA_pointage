import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type KpiItem = {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger" | "muted";
};

const toneClasses: Record<NonNullable<KpiItem["tone"]>, string> = {
  default: "from-brand-light/60 to-card border-brand/15",
  success: "from-status-approved-bg/80 to-card border-status-approved-text/15",
  warning: "from-status-pending-bg/80 to-card border-status-pending-text/15",
  danger: "from-status-rejected-bg/70 to-card border-status-rejected-text/15",
  muted: "from-muted/80 to-card border-border",
};

export function PresenceKpiStrip({ items, loading }: { items: KpiItem[]; loading?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-6">
      {items.map((k) => (
        <div key={k.label} className={cn("admin-kpi", toneClasses[k.tone ?? "default"])}>
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k.label}</div>
            <k.icon className="size-4 shrink-0 text-brand/70" aria-hidden />
          </div>
          <div className="mt-1 font-heading text-2xl tabular-data text-brand-dark md:text-3xl">
            {loading ? "…" : k.value}
          </div>
          {k.hint ? <p className="mt-1 text-[11px] text-muted-foreground">{k.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}

export type { KpiItem };
