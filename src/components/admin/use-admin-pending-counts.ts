"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase-firestore";

export type AdminPendingCounts = {
  congesPending: number;
  demandesAccesPending: number;
};

export function useAdminPendingCounts(): AdminPendingCounts {
  const [congesPending, setCongesPending] = useState(0);
  const [demandesAccesPending, setDemandesAccesPending] = useState(0);

  useEffect(() => {
    const db = getFirebaseFirestore();
    if (!db) return;

    const unsubConges = onSnapshot(
      query(collection(db, "conges"), where("statut", "==", "en_attente")),
      (snap) => setCongesPending(snap.size),
      () => setCongesPending(0),
    );

    const unsubDemandes = onSnapshot(
      query(collection(db, "demandes_acces"), where("statut", "==", "en_attente")),
      (snap) => setDemandesAccesPending(snap.size),
      () => setDemandesAccesPending(0),
    );

    return () => {
      unsubConges();
      unsubDemandes();
    };
  }, []);

  return { congesPending, demandesAccesPending };
}

export function getNavBadgeCount(
  badge: "conges" | "demandes" | undefined,
  counts: AdminPendingCounts,
): number {
  if (badge === "conges") return counts.congesPending;
  if (badge === "demandes") return counts.demandesAccesPending;
  return 0;
}
