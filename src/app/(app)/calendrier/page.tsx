"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AbsenceCalendar } from "@/components/calendar/absence-calendar";
import { useAuth } from "@/components/providers/auth-provider";
import type { CongeDoc } from "@/lib/data-model";
import { getFirebaseFirestore } from "@/lib/firebase-firestore";
import type { CongeCalendarRow } from "@/lib/calendar-utils";

export default function CalendrierPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<CongeCalendarRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const db = getFirebaseFirestore();
    if (!db) return;

    const q = query(collection(db, "conges"), where("userId", "==", user.uid), limit(200));

    const unsub = onSnapshot(
      q,
      (snap) => {
        setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as CongeDoc) })));
        setLoading(false);
      },
      () => {
        toast.error("Impossible de charger le calendrier");
        setLoading(false);
      },
    );

    return () => unsub();
  }, [user]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Calendrier</h1>
          <p className="text-muted-foreground">
            Visualisez vos congés, arrêts maladie et les jours fériés marocains.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/conges">Nouvelle demande de congé</Link>
        </Button>
      </div>

      <AbsenceCalendar
        conges={rows}
        loading={loading}
        includePending
        description="Vert = congé validé · Orange = en attente · Rose = maladie · Violet = jour férié."
      />
    </div>
  );
}
