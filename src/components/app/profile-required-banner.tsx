"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";

export function ProfileRequiredBanner() {
  const { user, role, profileComplete, mustChangePassword, loading } = useAuth();
  const router = useRouter();
  const toastShownRef = useRef(false);

  useEffect(() => {
    if (loading || !user || role !== "employe" || mustChangePassword) return;
    if (profileComplete !== false) return;

    void apiFetch("/api/notifications/profile-required", { method: "POST" }).catch(() => {
      /* notification créée côté serveur à l'approbation si possible */
    });
  }, [loading, user, role, profileComplete, mustChangePassword]);

  useEffect(() => {
    if (loading || !user || role !== "employe" || mustChangePassword) return;
    if (profileComplete !== false || toastShownRef.current) return;
    toastShownRef.current = true;
    toast.warning("Complétez votre profil — c'est obligatoire pour utiliser l'application.", {
      id: "profile-required",
      duration: 8000,
      action: {
        label: "Mon profil",
        onClick: () => router.push("/profil"),
      },
    });
  }, [loading, user, role, profileComplete, mustChangePassword, router]);

  if (loading || !user || role !== "employe" || mustChangePassword || profileComplete !== false) {
    return null;
  }

  return (
    <div className="border-b border-[color-mix(in_oklch,var(--warning)_35%,var(--border))] bg-[color-mix(in_oklch,var(--warning)_12%,var(--card))] px-4 py-3">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-brand-dark">Profil incomplet — action obligatoire</p>
          <p className="text-muted-foreground">
            Complétez votre profil employé avant de pointer ou demander des congés. Consultez aussi la cloche
            notifications 🔔.
          </p>
        </div>
        <Button type="button" size="sm" asChild className="shrink-0">
          <Link href="/profil">Compléter mon profil</Link>
        </Button>
      </div>
    </div>
  );
}
