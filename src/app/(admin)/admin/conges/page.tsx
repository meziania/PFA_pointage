"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getFirebaseFirestore } from "@/lib/firebase-firestore";
import type { CongeDoc, CongeStatut } from "@/lib/data-model";
import { updateCongeStatut } from "@/lib/firestore-helpers";

type Row = CongeDoc & { id: string };

function typeLabel(t: CongeDoc["type"]): string {
  if (t === "annuel") return "Annuel";
  if (t === "maladie") return "Maladie";
  return "Exceptionnel";
}

export default function AdminCongesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [view, setView] = useState<"en_attente" | "tous">("en_attente");

  useEffect(() => {
    const db = getFirebaseFirestore();
    if (!db) return;

    const q =
      view === "en_attente"
        ? query(collection(db, "conges"), where("statut", "==", "en_attente"), limit(200))
        : query(collection(db, "conges"), limit(400));

    const unsub = onSnapshot(
      q,
      (snap) => {
        setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as CongeDoc) })));
        setLoading(false);
      },
      (err) => {
        const msg =
          (err as { code?: string })?.code === "permission-denied"
            ? "Accès refusé (vérifie users/{uid}.role = admin + rules)"
            : (err as { code?: string })?.code === "failed-precondition"
              ? "Index Firestore manquant (ou requête non supportée)."
              : "Impossible de charger les congés";
        toast.error(msg);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [view]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => b.dateDebut.localeCompare(a.dateDebut));
    return copy;
  }, [rows]);

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
      toast.success(statut === "valide" ? "Congé validé" : "Congé refusé");
    } catch {
      toast.error("Impossible de mettre à jour le statut");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gestion des congés</h1>
        <p className="text-muted-foreground">Valider ou refuser les demandes en attente.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">En attente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[color-mix(in_oklch,var(--warning)_70%,white)]">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Validés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[color-mix(in_oklch,var(--success)_70%,white)]">{stats.validated}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Refusés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[color-mix(in_oklch,var(--destructive)_70%,white)]">{stats.refused}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <CardTitle>Demandes</CardTitle>
            <CardDescription>{loading ? "Chargement..." : `${sorted.length} demande(s)`}</CardDescription>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="button" size="sm" variant={view === "en_attente" ? "default" : "outline"} onClick={() => setView("en_attente")}>
                En attente
              </Button>
              <Button type="button" size="sm" variant={view === "tous" ? "default" : "outline"} onClick={() => setView("tous")}>
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
                  <th className="py-2 pr-4">UserId</th>
                  <th className="py-2 pr-4">Début</th>
                  <th className="py-2 pr-4">Fin</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Statut</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-mono text-xs">{r.userId}</td>
                    <td className="py-2 pr-4">{r.dateDebut}</td>
                    <td className="py-2 pr-4">{r.dateFin}</td>
                    <td className="py-2 pr-4">
                      <span className="rounded-full border bg-background px-3 py-1 text-xs font-medium">{typeLabel(r.type)}</span>
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={
                          r.statut === "valide"
                            ? "rounded-full border bg-[color-mix(in_oklch,var(--success)_18%,transparent)] px-3 py-1 text-xs font-medium"
                            : r.statut === "refuse"
                              ? "rounded-full border bg-[color-mix(in_oklch,var(--destructive)_18%,transparent)] px-3 py-1 text-xs font-medium"
                              : "rounded-full border bg-[color-mix(in_oklch,var(--warning)_18%,transparent)] px-3 py-1 text-xs font-medium"
                        }
                      >
                        {r.statut === "valide" ? "Validé" : r.statut === "refuse" ? "Refusé" : "En attente"}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={updatingId === r.id}
                          onClick={() => setStatut(r.id, "valide")}
                        >
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
                ))}
                {!loading && sorted.length === 0 ? (
                  <tr>
                    <td className="py-6 text-muted-foreground" colSpan={6}>
                      Aucun congé en attente.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

