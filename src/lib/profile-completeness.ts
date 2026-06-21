import type { UserDoc } from "@/lib/data-model";

export const PROFILE_REQUIRED_FIELDS = [
  "matricule",
  "telephone",
  "departement",
  "poste",
  "cin",
] as const satisfies ReadonlyArray<keyof UserDoc>;

export const PROFILE_FIELD_LABELS: Record<(typeof PROFILE_REQUIRED_FIELDS)[number], string> = {
  matricule: "Matricule",
  telephone: "Téléphone",
  departement: "Département",
  poste: "Poste",
  cin: "CIN",
};

export function getMissingProfileFields(user: Partial<UserDoc>): (typeof PROFILE_REQUIRED_FIELDS)[number][] {
  return PROFILE_REQUIRED_FIELDS.filter((key) => {
    const v = user[key];
    return typeof v !== "string" || !v.trim();
  });
}

export function isProfileComplete(user: Partial<UserDoc>): boolean {
  return getMissingProfileFields(user).length === 0;
}

export function profileCompletionPercent(user: Partial<UserDoc>): number {
  const filled = PROFILE_REQUIRED_FIELDS.length - getMissingProfileFields(user).length;
  return Math.round((filled / PROFILE_REQUIRED_FIELDS.length) * 100);
}
