"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import type { UserRole } from "@/lib/data-model";

export function RequireAuth({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: UserRole;
}) {
  const { user, role: currentRole, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (loading) return;
    if (!role) return;
    // Avoid redirect loops right after login/register: role may be temporarily null
    // while the user document is being created or fetched from Firestore.
    if (user && currentRole && currentRole !== role) router.replace("/");
  }, [loading, role, user, currentRole, router]);

  if (loading) return null;
  if (!user) return null;
  if (role && !currentRole) {
    return (
      <div className="grid min-h-[70dvh] place-items-center px-4">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
          <div className="text-lg font-semibold">Finalisation de votre compte…</div>
          <div className="mt-2 text-sm text-muted-foreground">
            On charge votre profil (rôle) depuis Firestore. Cela peut prendre quelques secondes juste après l’inscription.
          </div>
          <div className="mt-4 flex justify-center">
            <div className="h-2 w-40 overflow-hidden rounded-full bg-muted">
              <div className="h-2 w-1/2 animate-pulse rounded-full bg-primary" />
            </div>
          </div>
          <button
            type="button"
            className="mt-5 inline-flex h-10 items-center justify-center rounded-md border bg-background px-4 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => router.refresh()}
          >
            Recharger
          </button>
        </div>
      </div>
    );
  }
  if (role && currentRole !== role) return null;

  return children;
}

