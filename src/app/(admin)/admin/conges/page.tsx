"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { collection, doc, getDoc, limit, onSnapshot, query } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getFirebaseFirestore } from "@/lib/firebase-firestore";
import type { CongeDoc, CongeStatut } from "@/lib/data-model";
import { updateCongeStatut } from "@/lib/firestore-helpers";
import { AbsenceCalendar } from "@/components/calendar/absence-calendar";
import { CongesTabNav } from "@/components/conges/conges-tab-nav";
import { StatusBadge, congeStatutVariant } from "@/components/ui/status-badge";
import type { CongeCalendarRow } from "@/lib/calendar-utils";

type Row = CongeDoc & { id: string };
type UserMini = { nom?: string; email?: string } | null;
type TabId = "calendrier" | "validation";

const TABS = [
  { id: "calendrier" as const, label: "Calendrier équipe" },
  { id: "validation" as const, label: "Validation des demandes" },
];

function typeLabel(t: CongeDoc["type"]): string {
  if (t === "annuel") return "Annuel";
  if (t === "maladie") return "Maladie";
  return "Exceptionnel";
}

export default function AdminCongesPage() {
  const [tab, setTab] = useState<TabId>("validation");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [view, setView] = useState<"en_attente" | "tous">("en_attente");
  const [usersById, setUsersById] = useState<Record<string, UserMini>>({});

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "calendrier" || t === "validation") setTab(t);
  }, []);

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
            ? "Accès refusé (vérifie users/{uid}.role = admin + rules)"
            : (err as { code?: string })?.code === "failed-precondition"
              ? "Index Firestore manquant."
              : "Impossible de charger les congés";
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

  const enriched: CongeCalendarRow[] = useMemo(
    () =>
      rows.map((r) => {
        const u = usersById[r.userId];
        const userName = u?.nom || u?.email;
        return userName ? { ...r, userName } : r;
      }),
    [rows, usersById],
  );

  const tableRows = useMemo(() => {
    const filtered = view === "en_attente" ? rows.filter((r) => r.statut === "en_attente") : rows;
    const copy = [...filtered];
    copy.sort((a, b) => b.dateDebut.localeCompare(a.dateDebut));
    return copy;
  }, [rows, view]);

  const stats = useMemo(() => {
    let pending = 0;
    let validated = 0;
    let refused = 0;
    for (const r of rows) {
      if (r.statut === "valide") validated += 1;
      else if (r.statut === "refuse") refused += 1;
      else pending += 1;
    }
    return { pending, validated, refused };
  }, [rows]);

  async function setStatut(id: string, statut: CongeStatut) {
    setUpdatingId(id);
    try {
      await updateCongeStatut(id, statut);
      toast.success(statut === "valide" ? "Congé validé — visible sur le calendrier" : "Congé refusé");
    } catch {
      toast.error("Impossible de mettre à jour le statut");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl text-brand-dark md:text-2xl">Congés & calendrier</h1>
        <p className="mt-1 text-muted-foreground">
          Même données partout : valider une demande met à jour le calendrier équipe automatiquement.
        </p>
      </div>

      <CongesTabNav tabs={TABS} active={tab} onChange={(id) => setTab(id as TabId)} />

      {tab === "calendrier" ? (
        <AbsenceCalendar
          title="Calendrier des absences — équipe"
          conges={enriched}
          loading={loading}
          showAllEmployees
          includePending
          description="Jours fériés + congés de tous les employés. Orange = en attente de validation."
        />
      ) : null}

      {tab === "validation" ? (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="admin-kpi">
              <div className="text-xs text-muted-foreground">En attente</div>
              <div className="mt-1 font-heading text-2xl tabular-data text-status-pending-text">{stats.pending}</div>
            </div>
            <div className="admin-kpi">
              <div className="text-xs text-muted-foreground">Validés</div>
              <div className="mt-1 font-heading text-2xl tabular-data text-brand">{stats.validated}</div>
            </div>
            <div className="admin-kpi">
              <div className="text-xs text-muted-foreground">Refusés</div>
              <div className="mt-1 font-heading text-2xl tabular-data text-status-rejected-text">{stats.refused}</div>
            </div>
          </div>

          <Card>
            <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <CardTitle>Demandes à traiter</CardTitle>
                <CardDescription>{loading ? "Chargement..." : `${tableRows.length} demande(s)`}</CardDescription>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={view === "en_attente" ? "default" : "outline"}
                    onClick={() => setView("en_attente")}
                  >
                    En attente
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={view === "tous" ? "default" : "outline"}
                    onClick={() => setView("tous")}
                  >
                    Tous
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-2 pr-4">Employé</th>
                      <th className="py-2 pr-4 whitespace-nowrap">Début</th>
                      <th className="py-2 pr-4 whitespace-nowrap">Fin</th>
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2 pr-4">Statut</th>
                      <th className="py-2 pr-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((r) => {
                      const u = usersById[r.userId];
                      const displayName = u?.nom || u?.email || "Employé";
                      return (
                        <tr key={r.id} className="border-b last:border-0 align-top">
                          <td className="py-2 pr-4">
                            <div className="min-w-[220px]">
                              <div className="font-medium">{displayName}</div>
                              <div className="text-xs text-muted-foreground">{u?.email ? u.email : r.userId}</div>
                            </div>
                          </td>
                          <td className="py-2 pr-4 whitespace-nowrap tabular-nums">{r.dateDebut}</td>
                          <td className="py-2 pr-4 whitespace-nowrap tabular-nums">{r.dateFin}</td>
                          <td className="py-2 pr-4">
                            <span className="rounded-full border bg-background px-3 py-1 text-xs font-medium">
                              {typeLabel(r.type)}
                            </span>
                          </td>
                          <td className="py-2 pr-4">
                            <StatusBadge variant={congeStatutVariant(r.statut)}>
                              {r.statut === "valide" ? "Validé" : r.statut === "refuse" ? "Refusé" : "En attente"}
                            </StatusBadge>
                          </td>
                          <td className="py-2 pr-4">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button size="sm" disabled={updatingId === r.id} onClick={() => setStatut(r.id, "valide")}>
                                Valider
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={updatingId === r.id}
                                onClick={() => setStatut(r.id, "refuse")}
                              >
                                Refuser
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!loading && tableRows.length === 0 ? (
                      <tr>
                        <td className="py-6 text-muted-foreground" colSpan={6}>
                          Aucune demande dans cette vue.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
