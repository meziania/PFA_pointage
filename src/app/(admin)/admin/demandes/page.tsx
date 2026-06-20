"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, query } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getFirebaseFirestore } from "@/lib/firebase-firestore";
import type { DemandeAccesDoc } from "@/lib/data-model";
import { approuverDemandeAcces, refuserDemandeAcces, apiErrorMessage } from "@/lib/user-management";
import { StatusBadge, demandeAccesVariant } from "@/components/ui/status-badge";
import { unwrapTimestamp } from "@/lib/firestore-helpers";

type Row = DemandeAccesDoc & { id: string };

function formatDate(ts: unknown): string {
  const d = unwrapTimestamp(ts);
  return d ? d.toLocaleString("fr-FR") : "—";
}

function statutLabel(statut: DemandeAccesDoc["statut"]): string {
  if (statut === "approuvee") return "Approuvée";
  if (statut === "refusee") return "Refusée";
  return "En attente";
}

export default function AdminDemandesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"en_attente" | "tous">("en_attente");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [lastCredentials, setLastCredentials] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    const db = getFirebaseFirestore();
    if (!db) return;

    const unsub = onSnapshot(
      query(collection(db, "demandes_acces"), limit(200)),
      (snap) => {
        setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as DemandeAccesDoc) })));
        setLoading(false);
      },
      () => {
        toast.error("Impossible de charger les demandes d'accès");
        setLoading(false);
      },
    );

    return () => unsub();
  }, []);

  const tableRows = useMemo(() => {
    const filtered = view === "en_attente" ? rows.filter((r) => r.statut === "en_attente") : rows;
    return [...filtered].sort((a, b) => {
      const aa = unwrapTimestamp(a.date_demande)?.getTime() ?? 0;
      const bb = unwrapTimestamp(b.date_demande)?.getTime() ?? 0;
      return bb - aa;
    });
  }, [rows, view]);

  const pendingCount = useMemo(() => rows.filter((r) => r.statut === "en_attente").length, [rows]);

  async function approve(id: string) {
    setUpdatingId(id);
    try {
      const result = await approuverDemandeAcces(id);
      setLastCredentials({ email: result.email, password: result.temporaryPassword });
      toast.success(`Compte créé pour ${result.email}. Un email a été envoyé avec les identifiants.`);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Impossible d'approuver la demande."));
    } finally {
      setUpdatingId(null);
    }
  }

  async function refuse(id: string) {
    setUpdatingId(id);
    try {
      await refuserDemandeAcces(id);
      toast.success("Demande refusée — notification envoyée");
    } catch (error) {
      toast.error(apiErrorMessage(error, "Impossible de refuser la demande."));
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl text-brand-dark md:text-2xl">Demandes d&apos;accès</h1>
        <p className="text-muted-foreground">
          Flux : demande publique → examen admin → création du compte + email avec identifiants et lien de connexion.
        </p>
      </div>

      {lastCredentials ? (
        <Card>
          <CardHeader>
            <CardTitle>Derniers identifiants générés</CardTitle>
            <CardDescription>À transmettre si l&apos;email n&apos;est pas configuré (SMTP).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Email : <span className="font-mono">{lastCredentials.email}</span>
            </p>
            <p>
              Mot de passe temporaire : <span className="font-mono">{lastCredentials.password}</span>
            </p>
            <Button type="button" size="sm" variant="outline" onClick={() => setLastCredentials(null)}>
              Fermer
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <CardTitle>Demandes reçues</CardTitle>
            <CardDescription>
              {loading ? "Chargement..." : `${tableRows.length} demande(s) · ${pendingCount} en attente`}
            </CardDescription>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="button" size="sm" variant={view === "en_attente" ? "default" : "outline"} onClick={() => setView("en_attente")}>
                En attente
              </Button>
              <Button type="button" size="sm" variant={view === "tous" ? "default" : "outline"} onClick={() => setView("tous")}>
                Toutes
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-4">Candidat</th>
                  <th className="py-2 pr-4">Téléphone</th>
                  <th className="py-2 pr-4">Message</th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Statut</th>
                  <th className="py-2 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 align-top">
                    <td className="py-3 pr-4">
                      <div className="font-medium">{r.nom}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </td>
                    <td className="py-3 pr-4">{r.telephone ?? "—"}</td>
                    <td className="py-3 pr-4 max-w-[220px] truncate" title={r.message ?? ""}>
                      {r.message ?? "—"}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">{formatDate(r.date_demande)}</td>
                    <td className="py-3 pr-4">
                      <StatusBadge variant={demandeAccesVariant(r.statut)}>{statutLabel(r.statut)}</StatusBadge>
                    </td>
                    <td className="py-3 pr-4">
                      {r.statut === "en_attente" ? (
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button size="sm" disabled={updatingId === r.id} onClick={() => approve(r.id)}>
                            Approuver
                          </Button>
                          <Button size="sm" variant="outline" disabled={updatingId === r.id} onClick={() => refuse(r.id)}>
                            Refuser
                          </Button>
                        </div>
                      ) : (
                        <div className="text-right text-xs text-muted-foreground">Traitée</div>
                      )}
                    </td>
                  </tr>
                ))}
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
    </div>
  );
}
