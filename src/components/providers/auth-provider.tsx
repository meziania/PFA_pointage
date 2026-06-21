"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { getFirebaseAuth } from "@/lib/firebase-auth";
import { getFirebaseFirestore } from "@/lib/firebase-firestore";
import { getUserDoc, getUserRole, getUserStatut, userMustChangePassword } from "@/lib/firestore-helpers";
import { isProfileComplete } from "@/lib/profile-completeness";
import type { UserDoc, UserRole, UserStatut } from "@/lib/data-model";

type AuthState = {
  user: User | null;
  role: UserRole | null;
  statut: UserStatut | null;
  mustChangePassword: boolean;
  profileComplete: boolean | null;
  profilePhotoURL: string | null;
  loading: boolean;
  refreshProfilePhoto: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getFirebaseAuth()?.currentUser ?? null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [statut, setStatut] = useState<UserStatut | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);
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
      const profile = await getUserDoc(u.uid);
      setProfilePhotoURL(profile?.photoURL ?? u.photoURL ?? null);
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
        setStatut(null);
        setMustChangePassword(false);
        setProfileComplete(null);
        setProfilePhotoURL(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        let r: UserRole | null = null;
        let s: UserStatut | null = null;
        let mustChange = false;

        for (let i = 0; i < 10; i += 1) {
          r = await getUserRole(u.uid);
          s = await getUserStatut(u.uid);
          mustChange = await userMustChangePassword(u.uid);
          if (r && s) break;
          await new Promise((res) => setTimeout(res, 300));
        }

        setRole(r);
        setStatut(s);
        setMustChangePassword(mustChange);

        const profile = await getUserDoc(u.uid);
        setProfilePhotoURL(profile?.photoURL ?? u.photoURL ?? null);
        if (r === "employe") {
          setProfileComplete(profile ? isProfileComplete(profile) : false);
        } else {
          setProfileComplete(null);
        }
      } catch {
        setRole(null);
        setStatut(null);
        setMustChangePassword(false);
        setProfileComplete(null);
        setProfilePhotoURL(u.photoURL ?? null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const db = getFirebaseFirestore();
    if (!db || !user?.uid || role !== "employe") return;

    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setProfileComplete(false);
          return;
        }
        setProfileComplete(isProfileComplete(snap.data() as UserDoc));
      },
      () => setProfileComplete(false),
    );

    return () => unsub();
  }, [user?.uid, role]);

  const value = useMemo(
    () => ({ user, role, statut, mustChangePassword, profileComplete, profilePhotoURL, loading, refreshProfilePhoto }),
    [user, role, statut, mustChangePassword, profileComplete, profilePhotoURL, loading, refreshProfilePhoto],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
