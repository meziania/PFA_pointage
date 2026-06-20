import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatusVariant = "pending" | "approved" | "rejected" | "inactive";

const variantClasses: Record<StatusVariant, string> = {
  pending: "bg-status-pending-bg text-status-pending-text",
  approved: "bg-status-approved-bg text-status-approved-text",
  rejected: "bg-status-rejected-bg text-status-rejected-text",
  inactive: "bg-status-inactive-bg text-status-inactive-text",
};

export function StatusBadge({
  variant,
  children,
  className,
}: {
  variant: StatusVariant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function demandeAccesVariant(statut: string): StatusVariant {
  if (statut === "approuvee") return "approved";
  if (statut === "refusee") return "rejected";
  return "pending";
}

export function employeStatutVariant(statut: string | undefined): StatusVariant {
  return (statut ?? "actif") === "actif" ? "approved" : "inactive";
}

export function congeStatutVariant(statut: string): StatusVariant {
  if (statut === "valide") return "approved";
  if (statut === "refuse") return "rejected";
  return "pending";
}
