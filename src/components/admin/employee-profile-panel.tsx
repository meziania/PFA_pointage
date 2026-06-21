"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge, employeStatutVariant } from "@/components/ui/status-badge";
import type { UserDoc } from "@/lib/data-model";
import {
  getMissingProfileFields,
  PROFILE_FIELD_LABELS,
  profileCompletionPercent,
} from "@/lib/profile-completeness";
import { cn } from "@/lib/utils";

export type EmployeeRow = UserDoc & { id: string };

type Props = {
  employee: EmployeeRow | null;
  onClose: () => void;
  onEdit?: (employee: EmployeeRow) => void;
};

function displayValue(value: string | undefined): string {
  const v = value?.trim();
  return v ? v : "—";
}

function formatDate(value: string | undefined): string {
  const v = value?.trim();
  if (!v) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return v;
}

function ProfileField({
  label,
  value,
  missing,
}: {
  label: string;
  value: string;
  missing?: boolean;
}) {
  return (
    <div className="rounded-lg border border-brand/10 bg-background/60 px-3 py-2.5">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 break-words text-sm", missing && value === "—" && "font-medium text-status-pending-text")}>
        {value}
      </div>
    </div>
  );
}

export function EmployeeProfilePanel({ employee, onClose, onEdit }: Props) {
  if (!employee) return null;

  const missing = getMissingProfileFields(employee);
  const missingSet = new Set(missing);
  const completion = profileCompletionPercent(employee);
  const profileOk = missing.length === 0;
  const initials = (employee.nom ?? employee.email ?? "?").slice(0, 1).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-brand-dark/40"
        onClick={onClose}
        aria-label="Fermer le profil"
      />
      <div
        className="relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-brand/15 bg-card shadow-elevated sm:max-h-[85dvh] sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-profile-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-brand/10 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {employee.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={employee.photoURL}
                alt=""
                className="size-14 shrink-0 rounded-full border-2 border-brand/20 object-cover"
              />
            ) : (
              <span className="flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-brand/20 bg-brand-light text-lg font-bold text-brand-dark">
                {initials}
              </span>
            )}
            <div className="min-w-0">
              <h2 id="employee-profile-title" className="truncate font-heading text-lg text-brand-dark">
                {employee.nom || "Sans nom"}
              </h2>
              <p className="truncate text-sm text-muted-foreground">{employee.email}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium capitalize">
                  {employee.role}
                </span>
                <StatusBadge variant={employeStatutVariant(employee.statut)}>
                  {(employee.statut ?? "actif") === "actif" ? "Actif" : "Désactivé"}
                </StatusBadge>
                {employee.role === "employe" ? (
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                      profileOk
                        ? "bg-status-approved-bg text-status-approved-text"
                        : "bg-status-pending-bg text-status-pending-text",
                    )}
                  >
                    Profil {completion}%
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="touch-target shrink-0 rounded-lg border border-brand/15 p-2"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!profileOk && employee.role === "employe" ? (
            <div className="mb-4 rounded-lg border border-[color-mix(in_oklch,var(--warning)_35%,var(--border))] bg-[color-mix(in_oklch,var(--warning)_10%,var(--card))] px-3 py-2.5 text-sm text-brand-dark">
              Champs obligatoires manquants :{" "}
              {missing.map((f) => PROFILE_FIELD_LABELS[f]).join(", ")}.
            </div>
          ) : null}

          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Informations RH</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <ProfileField label="Matricule" value={displayValue(employee.matricule)} missing={missingSet.has("matricule")} />
            <ProfileField label="Téléphone" value={displayValue(employee.telephone)} missing={missingSet.has("telephone")} />
            <ProfileField
              label="Département"
              value={displayValue(employee.departement)}
              missing={missingSet.has("departement")}
            />
            <ProfileField label="Poste" value={displayValue(employee.poste)} missing={missingSet.has("poste")} />
            <ProfileField label="CIN" value={displayValue(employee.cin)} missing={missingSet.has("cin")} />
          </div>

          <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Informations complémentaires
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <ProfileField label="Adresse" value={displayValue(employee.adresse)} />
            <ProfileField label="Date de naissance" value={formatDate(employee.dateNaissance)} />
            <ProfileField label="Date d'embauche" value={formatDate(employee.dateEmbauche)} />
          </div>

          <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Compte</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <ProfileField
              label="Changement mot de passe requis"
              value={employee.doit_changer_mdp ? "Oui (1ère connexion)" : "Non"}
            />
            <ProfileField label="Identifiant interne" value={employee.id} />
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-brand/10 px-4 py-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onClose}>
            Fermer
          </Button>
          {employee.role === "employe" && onEdit ? (
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => {
                onEdit(employee);
                onClose();
              }}
            >
              Modifier le profil
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
