"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase-auth";
import { getUserDoc, getUserRole } from "@/lib/firestore-helpers";
import type { UserRole } from "@/lib/data-model";

type AuthState = {
  user: User | null;
  role: UserRole | null;
  profilePhotoURL: string | null;
  loading: boolean;
  refreshProfilePhoto: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getFirebaseAuth()?.currentUser ?? null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [profilePhotoURL, setProfilePhotoURL] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => Boolean(getFirebaseAuth()));

  const refreshProfilePhoto = useCallback(async () => {
    const auth = getFirebaseAuth();
    const u = auth?.currentUser;
    if (!u) {
      setProfilePhotoURL(null);
      return;
    }
    try {
      const doc = await getUserDoc(u.uid);
      setProfilePhotoURL(doc?.photoURL ?? u.photoURL ?? null);
    } catch {
      setProfilePhotoURL(u.photoURL ?? null);
    }
  }, []);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) return;

    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setRole(null);
        setProfilePhotoURL(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        let r: UserRole | null = null;
        for (let i = 0; i < 10; i += 1) {
          r = await getUserRole(u.uid);
          if (r) break;
          await new Promise((res) => setTimeout(res, 300));
        }
        setRole(r);

        const doc = await getUserDoc(u.uid);
        setProfilePhotoURL(doc?.photoURL ?? u.photoURL ?? null);
      } catch {
        setRole(null);
        setProfilePhotoURL(u.photoURL ?? null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const value = useMemo(
    () => ({ user, role, profilePhotoURL, loading, refreshProfilePhoto }),
    [user, role, profilePhotoURL, loading, refreshProfilePhoto],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
