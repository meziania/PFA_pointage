"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { useAuth } from "@/components/providers/auth-provider";
import { getFirebaseAuth } from "@/lib/firebase-auth";
import type { UserRole } from "@/lib/data-model";

export function RequireAuth({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: UserRole;
}) {
  const { user, role: currentRole, statut, mustChangePassword, profileComplete, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (loading || !user) return;

    if (statut && statut !== "actif") {
      void (async () => {
        const auth = getFirebaseAuth();
        if (auth) await signOut(auth);
        router.replace("/login");
      })();
      return;
    }

    if (mustChangePassword && pathname !== "/changer-mot-de-passe") {
      router.replace("/changer-mot-de-passe");
      return;
    }

    if (
      currentRole === "employe" &&
      profileComplete === false &&
      pathname !== "/profil" &&
      pathname !== "/changer-mot-de-passe"
    ) {
      router.replace("/profil");
    }
  }, [loading, user, statut, mustChangePassword, profileComplete, currentRole, pathname, router]);

  useEffect(() => {
    if (loading) return;
    if (!role) return;
    if (user && currentRole && currentRole !== role) router.replace("/");
  }, [loading, role, user, currentRole, router]);

  if (loading) return null;
  if (!user) return null;

  if (statut && statut !== "actif") return null;

  if (mustChangePassword && pathname !== "/changer-mot-de-passe") return null;

  if (
    currentRole === "employe" &&
    profileComplete === false &&
    pathname !== "/profil" &&
    pathname !== "/changer-mot-de-passe"
  ) {
    return null;
  }

  if (role && !currentRole) {
    return (
      <div className="grid min-h-[70dvh] place-items-center px-4">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
          <div className="text-lg font-semibold">Finalisation de votre compte…</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Chargement de votre profil depuis Firestore.
          </div>
        </div>
      </div>
    );
  }
  if (role && currentRole !== role) return null;

  return children;
}
