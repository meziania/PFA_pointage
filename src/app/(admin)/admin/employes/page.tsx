"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, query } from "firebase/firestore";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { getFirebaseFirestore } from "@/lib/firebase-firestore";
import type { UserDoc } from "@/lib/data-model";
import { apiErrorMessage, createEmployeeAccount, desactiverEmploye, reactiverEmploye, supprimerEmploye, updateEmploye } from "@/lib/user-management";
import { StatusBadge, employeStatutVariant } from "@/components/ui/status-badge";

type Row = UserDoc & { id: string };
type SortKey = "nom" | "matricule" | "departement" | "poste" | "profil";

function profileCompleteness(u: Row): { score: number; label: string } {
  const fields = [u.matricule, u.telephone, u.departement, u.poste, u.cin, u.adresse, u.dateNaissance, u.dateEmbauche];
  const filled = fields.filter((x) => typeof x === "string" && x.trim().length > 0).length;
  const total = fields.length;
  const pct = Math.round((filled / total) * 100);
  return { score: pct, label: `${pct}%` };
}

function downloadText(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(v: string): string {
  const s = v ?? "";
  if (/[",\n]/.test(s)) return `"${s.replaceAll("\"", "\"\"")}"`;
  return s;
}

const createSchema = z.object({
  nom: z.string().min(2, { message: "Au moins 2 caractères." }),
  email: z.string().email({ message: "Email invalide." }),
  password: z.string().min(6, { message: "Au moins 6 caractères." }),
  matricule: z.string().optional(),
  departement: z.string().optional(),
  poste: z.string().optional(),
  telephone: z.string().optional(),
});

const editSchema = z.object({
  nom: z.string().min(2, { message: "Au moins 2 caractères." }),
  email: z.string().email({ message: "Email invalide." }),
  matricule: z.string().optional(),
  departement: z.string().optional(),
  poste: z.string().optional(),
  telephone: z.string().optional(),
  cin: z.string().optional(),
  adresse: z.string().optional(),
  dateNaissance: z.string().optional(),
  dateEmbauche: z.string().optional(),
});

export default function AdminEmployesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [qtext, setQtext] = useState("");
  const [view, setView] = useState<"employes" | "tous">("employes");
  const [sort, setSort] = useState<SortKey>("profil");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Row | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);

  const editForm = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      nom: "",
      email: "",
      matricule: "",
      departement: "",
      poste: "",
      telephone: "",
      cin: "",
      adresse: "",
      dateNaissance: "",
      dateEmbauche: "",
    },
  });

  const createForm = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      nom: "",
      email: "",
      password: "",
      matricule: "",
      departement: "",
      poste: "",
      telephone: "",
    },
  });

  useEffect(() => {
    const db = getFirebaseFirestore();
    if (!db) return;

    // Avoid composite index requirements; sort client-side if needed.
    const q = query(collection(db, "users"), limit(500));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as UserDoc) })));
        setLoading(false);
      },
      () => {
        toast.error("Impossible de charger les employés");
        setLoading(false);
      },
    );

    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const base = view === "employes" ? rows.filter((r) => r.role === "employe") : rows;
    const q = qtext.trim().toLowerCase();
    const searched = !q
      ? base
      : base.filter((r) =>
          `${r.nom} ${r.email} ${r.role} ${r.matricule ?? ""} ${r.departement ?? ""} ${r.poste ?? ""}`.toLowerCase().includes(q),
        );

    const sorted = searched.slice().sort((a, b) => {
      if (sort === "profil") return profileCompleteness(b).score - profileCompleteness(a).score;
      const av = String((a as Record<string, unknown>)[sort] ?? "").toLowerCase();
      const bv = String((b as Record<string, unknown>)[sort] ?? "").toLowerCase();
      return av.localeCompare(bv);
    });
    return sorted;
  }, [rows, qtext, view, sort]);

  async function onCreateEmployee(values: z.infer<typeof createSchema>) {
    setCreating(true);
    try {
      const result = await createEmployeeAccount({
        nom: values.nom,
        email: values.email,
        password: values.password,
        matricule: values.matricule?.trim() || undefined,
        departement: values.departement?.trim() || undefined,
        poste: values.poste?.trim() || undefined,
        telephone: values.telephone?.trim() || undefined,
      });
      setCreatedCredentials({ email: result.email, password: values.password });
      createForm.reset();
      toast.success("Compte employé créé. Transmettez les identifiants à l'employé.");
    } catch (error) {
      toast.error(apiErrorMessage(error, "Impossible de créer le compte."));
    } finally {
      setCreating(false);
    }
  }

  async function deactivateEmployee(userId: string) {
    setDeactivatingId(userId);
    try {
      await desactiverEmploye(userId);
      toast.success("Employé désactivé — historique conservé");
      if (editingEmployee?.id === userId) setEditingEmployee(null);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Impossible de désactiver l'employé."));
    } finally {
      setDeactivatingId(null);
    }
  }

  async function reactivateEmployee(userId: string) {
    setReactivatingId(userId);
    try {
      await reactiverEmploye(userId);
      toast.success("Employé réactivé — connexion à nouveau possible");
    } catch (error) {
      toast.error(apiErrorMessage(error, "Impossible de réactiver l'employé."));
    } finally {
      setReactivatingId(null);
    }
  }

  function startEdit(employee: Row) {
    setEditingEmployee(employee);
    editForm.reset({
      nom: employee.nom ?? "",
      email: employee.email ?? "",
      matricule: employee.matricule ?? "",
      departement: employee.departement ?? "",
      poste: employee.poste ?? "",
      telephone: employee.telephone ?? "",
      cin: employee.cin ?? "",
      adresse: employee.adresse ?? "",
      dateNaissance: employee.dateNaissance ?? "",
      dateEmbauche: employee.dateEmbauche ?? "",
    });
  }

  async function deleteEmployee(userId: string, nom: string) {
    if (
      !window.confirm(
        `Supprimer définitivement ${nom} ? Le compte de connexion sera supprimé. L'historique de pointage sera conservé.`,
      )
    ) {
      return;
    }
    setDeletingId(userId);
    try {
      await supprimerEmploye(userId);
      toast.success("Employé supprimé — historique de pointage conservé");
      if (editingEmployee?.id === userId) setEditingEmployee(null);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Impossible de supprimer l'employé."));
    } finally {
      setDeletingId(null);
    }
  }

  async function onSaveEdit(values: z.infer<typeof editSchema>) {
    if (!editingEmployee) return;
    setSavingEdit(true);
    try {
      await updateEmploye(editingEmployee.id, {
        nom: values.nom,
        email: values.email,
        matricule: values.matricule?.trim() || undefined,
        departement: values.departement?.trim() || undefined,
        poste: values.poste?.trim() || undefined,
        telephone: values.telephone?.trim() || undefined,
        cin: values.cin?.trim() || undefined,
        adresse: values.adresse?.trim() || undefined,
        dateNaissance: values.dateNaissance?.trim() || undefined,
        dateEmbauche: values.dateEmbauche?.trim() || undefined,
      });
      toast.success("Profil employé mis à jour");
      setEditingEmployee(null);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Impossible de mettre à jour l'employé."));
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-heading text-xl text-brand-dark md:text-2xl">Employés</h1>
          <p className="text-muted-foreground">
            Créez, modifiez et désactivez les comptes employés. La désactivation conserve l&apos;historique de pointage et
            congés.
          </p>
        </div>
        <Button type="button" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? "Masquer le formulaire" : "Créer un employé"}
        </Button>
      </div>

      {showCreate ? (
        <Card>
          <CardHeader>
            <CardTitle>Nouveau compte employé</CardTitle>
            <CardDescription>
              Le mot de passe sera transmis manuellement à l&apos;employé (email, SMS, etc.).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {createdCredentials ? (
              <div className="mb-4 space-y-2 rounded-lg border bg-muted/40 p-4 text-sm">
                <p className="font-medium">Identifiants à transmettre</p>
                <p>
                  Email : <span className="font-mono">{createdCredentials.email}</span>
                </p>
                <p>
                  Mot de passe : <span className="font-mono">{createdCredentials.password}</span>
                </p>
                <Button type="button" variant="outline" size="sm" onClick={() => setCreatedCredentials(null)}>
                  Fermer
                </Button>
              </div>
            ) : null}
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(onCreateEmployee)} className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={createForm.control}
                  name="nom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom complet</FormLabel>
                      <FormControl>
                        <Input placeholder="Jean Dupont" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="jean@exemple.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mot de passe temporaire</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="matricule"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Matricule</FormLabel>
                      <FormControl>
                        <Input placeholder="EMP-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="departement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Département</FormLabel>
                      <FormControl>
                        <Input placeholder="RH" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="poste"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Poste</FormLabel>
                      <FormControl>
                        <Input placeholder="Assistant" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="telephone"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Téléphone</FormLabel>
                      <FormControl>
                        <Input placeholder="+212..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="md:col-span-2">
                  <Button type="submit" disabled={creating}>
                    {creating ? "Création..." : "Créer le compte"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      ) : null}

      {editingEmployee ? (
        <Card>
          <CardHeader className="gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Modifier l&apos;employé</CardTitle>
              <CardDescription>{editingEmployee.email}</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditingEmployee(null)}>
              Fermer
            </Button>
          </CardHeader>
          <CardContent>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onSaveEdit)} className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={editForm.control}
                  name="nom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom complet</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="matricule"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Matricule</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="departement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Département</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="poste"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Poste</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="telephone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Téléphone</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="cin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CIN</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="adresse"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Adresse</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="dateNaissance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date de naissance</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="dateEmbauche"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date d&apos;embauche</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex flex-wrap gap-2 md:col-span-2">
                  <Button type="submit" disabled={savingEdit}>
                    {savingEdit ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                  {(editingEmployee.statut ?? "actif") === "actif" ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={deactivatingId === editingEmployee.id}
                      onClick={() => deactivateEmployee(editingEmployee.id)}
                    >
                      Désactiver
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={reactivatingId === editingEmployee.id}
                      onClick={() => reactivateEmployee(editingEmployee.id)}
                    >
                      Réactiver
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={deletingId === editingEmployee.id}
                    onClick={() => deleteEmployee(editingEmployee.id, editingEmployee.nom)}
                  >
                    Supprimer
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <CardTitle>Comptes</CardTitle>
            <CardDescription>
              {loading ? "Chargement..." : `${filtered.length} ligne(s) · vue: ${view === "employes" ? "employés" : "tous"}`}
            </CardDescription>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="button" size="sm" variant={view === "employes" ? "default" : "outline"} onClick={() => setView("employes")}>
                Employés
              </Button>
              <Button type="button" size="sm" variant={view === "tous" ? "default" : "outline"} onClick={() => setView("tous")}>
                Tous (inclut admin)
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  const header = ["nom", "email", "role", "matricule", "departement", "poste", "telephone", "cin", "adresse"];
                  const lines = filtered.map((r) => [
                    r.nom ?? "",
                    r.email ?? "",
                    r.role ?? "",
                    r.matricule ?? "",
                    r.departement ?? "",
                    r.poste ?? "",
                    r.telephone ?? "",
                    r.cin ?? "",
                    r.adresse ?? "",
                  ]);
                  const csv = [header, ...lines].map((row) => row.map(csvEscape).join(",")).join("\n");
                  downloadText("employes.csv", csv, "text/csv;charset=utf-8");
                  toast.success("Export CSV généré");
                }}
              >
                Exporter CSV
              </Button>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 md:w-[420px] md:flex-row md:items-center">
            <div className="flex-1">
              <Input value={qtext} onChange={(e) => setQtext(e.target.value)} placeholder="Rechercher (nom, email, matricule…)" />
            </div>
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm md:w-44"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              <option value="profil">Profil (complet)</option>
              <option value="nom">Nom</option>
              <option value="matricule">Matricule</option>
              <option value="departement">Département</option>
              <option value="poste">Poste</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 md:hidden">
            {filtered.map((r) => {
              const p = profileCompleteness(r);
              const ok = p.score >= 60;
              return (
                <div key={r.id} className="mobile-data-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-brand-dark">{r.nom}</div>
                      <div className="truncate text-xs text-muted-foreground">{r.email}</div>
                    </div>
                    <StatusBadge variant={employeStatutVariant(r.statut)}>
                      {(r.statut ?? "actif") === "actif" ? "Actif" : "Désactivé"}
                    </StatusBadge>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>Matricule: {r.matricule ?? "—"}</span>
                    <span>Dép.: {r.departement ?? "—"}</span>
                    <span>Poste: {r.poste ?? "—"}</span>
                    <span
                      className={
                        ok
                          ? "font-medium text-status-approved-text"
                          : "font-medium text-status-pending-text"
                      }
                    >
                      Profil {p.label}
                    </span>
                  </div>
                  {r.role === "employe" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => startEdit(r)}>
                        Modifier
                      </Button>
                      {(r.statut ?? "actif") === "actif" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="flex-1 sm:flex-none"
                          disabled={deactivatingId === r.id}
                          onClick={() => deactivateEmployee(r.id)}
                        >
                          Désactiver
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          className="flex-1 sm:flex-none"
                          disabled={reactivatingId === r.id}
                          onClick={() => reactivateEmployee(r.id)}
                        >
                          Réactiver
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="w-full sm:w-auto"
                        disabled={deletingId === r.id}
                        onClick={() => deleteEmployee(r.id, r.nom)}
                      >
                        Supprimer
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">Compte administrateur</p>
                  )}
                </div>
              );
            })}
            {!loading && filtered.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground">Aucun résultat.</p>
            ) : null}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-4">Nom</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Matricule</th>
                  <th className="py-2 pr-4">Département</th>
                  <th className="py-2 pr-4">Poste</th>
                  <th className="py-2 pr-4">Profil</th>
                  <th className="py-2 pr-4">Statut</th>
                  <th className="py-2 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium">{r.nom}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{r.email}</td>
                    <td className="py-3 pr-4">{r.matricule ?? "—"}</td>
                    <td className="py-3 pr-4">{r.departement ?? "—"}</td>
                    <td className="py-3 pr-4">{r.poste ?? "—"}</td>
                    <td className="py-3 pr-4">
                      {(() => {
                        const p = profileCompleteness(r);
                        const ok = p.score >= 60;
                        return (
                          <span
                            className={
                              ok
                                ? "inline-flex rounded-full border bg-[color-mix(in_oklch,var(--success)_18%,transparent)] px-3 py-1 text-xs font-medium"
                                : "inline-flex rounded-full border bg-[color-mix(in_oklch,var(--warning)_18%,transparent)] px-3 py-1 text-xs font-medium"
                            }
                          >
                            {p.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge variant={employeStatutVariant(r.statut)}>
                        {(r.statut ?? "actif") === "actif" ? "Actif" : "Désactivé"}
                      </StatusBadge>
                    </td>
                    <td className="py-3 pr-4">
                      {r.role === "employe" ? (
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => startEdit(r)}>
                            Modifier
                          </Button>
                          {(r.statut ?? "actif") === "actif" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={deactivatingId === r.id}
                              onClick={() => deactivateEmployee(r.id)}
                            >
                              Désactiver
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              disabled={reactivatingId === r.id}
                              onClick={() => reactivateEmployee(r.id)}
                            >
                              Réactiver
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={deletingId === r.id}
                            onClick={() => deleteEmployee(r.id, r.nom)}
                          >
                            Supprimer
                          </Button>
                        </div>
                      ) : (
                        <div className="text-right text-xs text-muted-foreground">—</div>
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 ? (
                  <tr>
                    <td className="py-6 text-muted-foreground" colSpan={8}>
                      Aucun résultat.
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

