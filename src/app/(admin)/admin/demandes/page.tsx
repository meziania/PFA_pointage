"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { DemandeAccesDoc } from "@/lib/data-model";
import { approuverDemandeAcces, refuserDemandeAcces, supprimerDemandeAcces, listDemandesAcces, apiErrorMessage } from "@/lib/user-management";
import { StatusBadge, demandeAccesVariant } from "@/components/ui/status-badge";
import { unwrapTimestamp } from "@/lib/firestore-helpers";

type Row = DemandeAccesDoc & { id: string };

type ApprovedCredentials = {
  nom: string;
  email: string;
  password: string;
  loginUrl: string;
  emailSent: boolean;
};

function formatDate(ts: unknown): string {
  const d = unwrapTimestamp(ts);
  return d ? d.toLocaleString("fr-FR") : "—";
}

function statutLabel(statut: DemandeAccesDoc["statut"]): string {
  if (statut === "approuvee") return "Approuvée";
  if (statut === "refusee") return "Refusée";
  return "En attente";
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copié`);
  } catch {
    toast.error("Impossible de copier");
  }
}

function credentialsMessage(c: ApprovedCredentials): string {
  return [
    "TimeTrack Pro — Identifiants de connexion",
    "",
    `Nom : ${c.nom}`,
    `Email : ${c.email}`,
    `Mot de passe temporaire : ${c.password}`,
    "",
    `Connexion : ${c.loginUrl}`,
    "",
    "L'employé devra changer son mot de passe à la première connexion.",
  ].join("\n");
}

export default function AdminDemandesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<"en_attente" | "tous">("en_attente");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lastCredentials, setLastCredentials] = useState<ApprovedCredentials | null>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await listDemandesAcces();
      setRows(result.demandes as Row[]);
    } catch (error) {
      const message = apiErrorMessage(error, "Impossible de charger les demandes d'accès");
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const tableRows = useMemo(() => {
    const filtered = view === "en_attente" ? rows.filter((r) => r.statut === "en_attente") : rows;
    return [...filtered].sort((a, b) => {
      const aa = unwrapTimestamp(a.date_demande)?.getTime() ?? 0;
      const bb = unwrapTimestamp(b.date_demande)?.getTime() ?? 0;
      return bb - aa;
    });
  }, [rows, view]);

  const pendingCount = useMemo(() => rows.filter((r) => r.statut === "en_attente").length, [rows]);

  async function approve(id: string, nom: string) {
    setUpdatingId(id);
    try {
      const result = await approuverDemandeAcces(id);
      setLastCredentials({
        nom,
        email: result.email,
        password: result.temporaryPassword,
        loginUrl: result.loginUrl,
        emailSent: result.emailSent,
      });
      if (result.emailSent) {
        toast.success(`Compte créé pour ${result.email}. Identifiants envoyés par email.`);
      } else {
        toast.success(`Compte créé pour ${result.email}. Transmettez les identifiants ci-dessous à l'employé.`);
      }
      await loadRows();
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
      toast.success("Demande refusée");
      await loadRows();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Impossible de refuser la demande."));
    } finally {
      setUpdatingId(null);
    }
  }

  async function remove(id: string, nom: string) {
    if (!window.confirm(`Supprimer définitivement la demande de ${nom} ?`)) return;
    setDeletingId(id);
    try {
      await supprimerDemandeAcces(id);
      toast.success("Demande supprimée");
      await loadRows();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Impossible de supprimer la demande."));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl text-brand-dark md:text-2xl">Demandes d&apos;accès</h1>
        <p className="text-muted-foreground">
          À l&apos;approbation, l&apos;application crée automatiquement un compte (email de la demande + mot de passe
          temporaire sécurisé) et affiche les identifiants à transmettre à l&apos;employé.
        </p>
      </div>

      {loadError ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Configuration serveur requise</CardTitle>
            <CardDescription>{loadError}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Téléchargez la clé de service Firebase (JSON) et placez-la à la racine sous{" "}
              <code className="rounded bg-muted px-1">serviceAccountKey.json</code>, ou ajoutez{" "}
              <code className="rounded bg-muted px-1">FIREBASE_SERVICE_ACCOUNT_KEY</code> sur Vercel.
            </p>
            <Button type="button" size="sm" variant="outline" onClick={() => void loadRows()}>
              Réessayer
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {lastCredentials ? (
        <Card className="border-[color-mix(in_oklch,var(--success)_35%,var(--border))] bg-[color-mix(in_oklch,var(--success)_8%,var(--card))]">
          <CardHeader>
            <CardTitle className="text-brand-dark">Identifiants générés — à transmettre à l&apos;employé</CardTitle>
            <CardDescription>
              Compte créé pour <strong>{lastCredentials.nom}</strong>.
              {lastCredentials.emailSent
                ? " Un email a aussi été envoyé au candidat."
                : " L'email n'a pas pu être envoyé : communiquez ces identifiants manuellement (SMS, oral, etc.)."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-2">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email de connexion</div>
                <div className="mt-1 font-mono text-base">{lastCredentials.email}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Mot de passe temporaire (généré)
                </div>
                <div className="mt-1 font-mono text-base">{lastCredentials.password}</div>
              </div>
              <div className="md:col-span-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Lien de connexion</div>
                <a
                  href={lastCredentials.loginUrl}
                  className="mt-1 block break-all text-brand hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {lastCredentials.loginUrl}
                </a>
              </div>
            </div>
            <p className="text-muted-foreground">
              L&apos;employé se connecte avec cet email et ce mot de passe, puis change son mot de passe à la première
              connexion.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => void copyText(lastCredentials.email, "Email")}>
                Copier l&apos;email
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void copyText(lastCredentials.password, "Mot de passe")}
              >
                Copier le mot de passe
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void copyText(credentialsMessage(lastCredentials), "Identifiants complets")}
              >
                Copier tout
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setLastCredentials(null)}>
                Fermer
              </Button>
            </div>
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
              <Button type="button" size="sm" variant="outline" onClick={() => void loadRows()} disabled={loading}>
                Actualiser
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 md:hidden">
            {tableRows.map((r) => (
              <div key={r.id} className="mobile-data-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-brand-dark">{r.nom}</div>
                    <div className="truncate text-xs text-muted-foreground">{r.email}</div>
                  </div>
                  <StatusBadge variant={demandeAccesVariant(r.statut)}>{statutLabel(r.statut)}</StatusBadge>
                </div>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {r.telephone ? <div>Tél. {r.telephone}</div> : null}
                  <div>{formatDate(r.date_demande)}</div>
                  {r.message ? <p className="line-clamp-2 text-foreground/80">{r.message}</p> : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.statut === "en_attente" ? (
                    <>
                      <Button size="sm" className="flex-1 sm:flex-none" disabled={updatingId === r.id || deletingId === r.id} onClick={() => approve(r.id, r.nom)}>
                        Approuver
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 sm:flex-none"
                        disabled={updatingId === r.id || deletingId === r.id}
                        onClick={() => refuse(r.id)}
                      >
                        Refuser
                      </Button>
                    </>
                  ) : null}
                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-full sm:w-auto"
                    disabled={updatingId === r.id || deletingId === r.id}
                    onClick={() => remove(r.id, r.nom)}
                  >
                    Supprimer
                  </Button>
                </div>
              </div>
            ))}
            {!loading && tableRows.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground">Aucune demande dans cette vue.</p>
            ) : null}
          </div>

          <div className="hidden overflow-x-auto md:block">
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
                      <div className="flex flex-wrap justify-end gap-2">
                        {r.statut === "en_attente" ? (
                          <>
                            <Button size="sm" disabled={updatingId === r.id || deletingId === r.id} onClick={() => approve(r.id, r.nom)}>
                              Approuver
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={updatingId === r.id || deletingId === r.id}
                              onClick={() => refuse(r.id)}
                            >
                              Refuser
                            </Button>
                          </>
                        ) : null}
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={updatingId === r.id || deletingId === r.id}
                          onClick={() => remove(r.id, r.nom)}
                        >
                          Supprimer
                        </Button>
                      </div>
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
