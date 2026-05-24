"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDoc, limit, onSnapshot, query } from "firebase/firestore";
import { toast } from "sonner";
import { AbsenceCalendar } from "@/components/calendar/absence-calendar";
import { getFirebaseFirestore } from "@/lib/firebase-firestore";
import type { CongeDoc } from "@/lib/data-model";
import type { CongeCalendarRow } from "@/lib/calendar-utils";

type UserMini = { nom?: string; email?: string } | null;

export default function AdminCalendrierPage() {
  const [rows, setRows] = useState<CongeCalendarRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersById, setUsersById] = useState<Record<string, UserMini>>({});

  useEffect(() => {
    const db = getFirebaseFirestore();
    if (!db) return;

    const unsub = onSnapshot(
      query(collection(db, "conges"), limit(500)),
      (snap) => {
        setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as CongeDoc) })));
        setLoading(false);
      },
      (err) => {
        const msg =
          (err as { code?: string })?.code === "permission-denied"
            ? "Accès refusé (règles Firestore admin)."
            : "Impossible de charger le calendrier";
        toast.error(msg);
        setLoading(false);
      },
    );

    return () => unsub();
  }, []);

  useEffect(() => {
    const db = getFirebaseFirestore();
    if (!db || !rows.length) return;

    const unique = Array.from(new Set(rows.map((r) => r.userId).filter(Boolean)));
    const missing = unique.filter((uid) => usersById[uid] === undefined);
    if (!missing.length) return;

    let cancelled = false;
    void (async () => {
      const next: Record<string, UserMini> = {};
      await Promise.all(
        missing.map(async (uid) => {
          try {
            const snap = await getDoc(doc(db, "users", uid));
            if (!snap.exists()) {
              next[uid] = null;
              return;
            }
            const data = snap.data() as { nom?: unknown; email?: unknown };
            next[uid] = {
              nom: typeof data.nom === "string" ? data.nom : undefined,
              email: typeof data.email === "string" ? data.email : undefined,
            };
          } catch {
            next[uid] = null;
          }
        }),
      );
      if (cancelled) return;
      setUsersById((prev) => ({ ...prev, ...next }));
    })();

    return () => {
      cancelled = true;
    };
  }, [rows, usersById]);

  const enriched: CongeCalendarRow[] = rows.map((r) => {
    const u = usersById[r.userId];
    const userName = u?.nom || u?.email;
    return userName ? { ...r, userName } : r;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Calendrier équipe</h1>
        <p className="text-muted-foreground">
          Vue globale : jours fériés, congés validés et demandes en attente de tous les employés.
        </p>
      </div>

      <AbsenceCalendar
        title="Calendrier des absences — équipe"
        conges={enriched}
        loading={loading}
        showAllEmployees
        includePending
        description="Cliquez sur un jour pour le détail. Les noms des employés s'affichent pour les congés."
      />
    </div>
  );
}
