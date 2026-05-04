"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, query } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getFirebaseFirestore } from "@/lib/firebase-firestore";
import type { UserDoc } from "@/lib/data-model";

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

export default function AdminEmployesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [qtext, setQtext] = useState("");
  const [view, setView] = useState<"employes" | "tous">("employes");
  const [sort, setSort] = useState<SortKey>("profil");

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Employés</h1>
        <p className="text-muted-foreground">
          Par défaut, on affiche uniquement les comptes <span className="font-medium">employe</span> (les admins ne sont pas des employés).
        </p>
      </div>

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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-4">Nom</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Matricule</th>
                  <th className="py-2 pr-4">Département</th>
                  <th className="py-2 pr-4">Poste</th>
                  <th className="py-2 pr-4">Profil</th>
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
                  </tr>
                ))}
                {!loading && filtered.length === 0 ? (
                  <tr>
                    <td className="py-6 text-muted-foreground" colSpan={6}>
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

