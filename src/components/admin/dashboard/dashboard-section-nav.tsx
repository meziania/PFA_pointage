import { cn } from "@/lib/utils";

export type DashboardSection = "today" | "journal" | "analytics" | "anomalies";

const SECTIONS: { key: DashboardSection; label: string; description: string }[] = [
  { key: "today", label: "Aujourd'hui", description: "Vue live" },
  { key: "journal", label: "Journal", description: "Pointages" },
  { key: "analytics", label: "Analyses", description: "Tendances" },
  { key: "anomalies", label: "Anomalies", description: "Alertes RH" },
];

export function DashboardSectionNav({
  active,
  onChange,
  counts,
}: {
  active: DashboardSection;
  onChange: (section: DashboardSection) => void;
  counts?: Partial<Record<DashboardSection, number>>;
}) {
  return (
    <div className="admin-surface grid grid-cols-2 gap-1 p-1 sm:grid-cols-4">
      {SECTIONS.map((s) => {
        const isActive = active === s.key;
        const count = counts?.[s.key];
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onChange(s.key)}
            className={cn(
              "rounded-lg px-3 py-2.5 text-left transition-colors",
              isActive ? "bg-brand text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-brand-light/60 hover:text-brand-dark",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{s.label}</span>
              {typeof count === "number" && count > 0 ? (
                <span
                  className={cn(
                    "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                    isActive ? "bg-white/20 text-white" : "bg-brand-light text-brand-dark",
                  )}
                >
                  {count}
                </span>
              ) : null}
            </div>
            <div className={cn("text-[11px]", isActive ? "text-primary-foreground/80" : "text-muted-foreground")}>
              {s.description}
            </div>
          </button>
        );
      })}
    </div>
  );
}
