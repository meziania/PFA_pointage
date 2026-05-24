"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { differenceInBusinessDays, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/components/providers/auth-provider";
import { requestConge } from "@/lib/firestore-helpers";
import type { CongeDoc, CongeType } from "@/lib/data-model";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase-firestore";
import { AbsenceCalendar } from "@/components/calendar/absence-calendar";
import { CongesTabNav } from "@/components/conges/conges-tab-nav";
import { congeDateToYmd, type CongeCalendarRow } from "@/lib/calendar-utils";

type Row = CongeDoc & { id: string };
type TabId = "calendrier" | "demande" | "historique";

const TABS: { id: TabId; label: string }[] = [
  { id: "calendrier", label: "Calendrier" },
  { id: "demande", label: "Nouvelle demande" },
  { id: "historique", label: "Mes demandes" },
];

const schema = z
  .object({
    dateDebut: z.string().min(10, "Date début requise"),
    dateFin: z.string().min(10, "Date fin requise"),
    type: z.enum(["annuel", "maladie", "exceptionnel"]),
    motif: z.string().optional(),
  })
  .refine((d) => d.dateFin >= d.dateDebut, {
    message: "La date de fin doit être au moins égale à la date de début",
    path: ["dateFin"],
  });

function typeLabel(t: CongeType): string {
  if (t === "annuel") return "Annuel";
  if (t === "maladie") return "Maladie";
  return "Exceptionnel";
}

function statutLabel(s: CongeDoc["statut"]): string {
  if (s === "valide") return "Validé";
  if (s === "refuse") return "Refusé";
  return "En attente";
}

function statutStyle(s: CongeDoc["statut"]): { dot: string; pill: string } {
  if (s === "valide") {
    return { dot: "bg-[var(--color-success)]", pill: "bg-[color-mix(in_oklch,var(--success)_20%,transparent)]" };
  }
  if (s === "refuse") {
    return { dot: "bg-[var(--color-destructive)]", pill: "bg-[color-mix(in_oklch,var(--destructive)_20%,transparent)]" };
  }
  return { dot: "bg-[var(--color-warning)]", pill: "bg-[color-mix(in_oklch,var(--warning)_20%,transparent)]" };
}

function safeBusinessDays(start: string, end: string): number | null {
  if (!start || !end) return null;
  try {
    const a = parseISO(start);
    const b = parseISO(end);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
    const d = differenceInBusinessDays(b, a) + 1;
    return d > 0 ? d : null;
  } catch {
    return null;
  }
}

export default function CongesPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabId>("calendrier");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "demande" || t === "historique" || t === "calendrier") setTab(t);
  }, []);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { dateDebut: "", dateFin: "", type: "annuel", motif: "" },
  });

  useEffect(() => {
    if (!user) return;
    const db = getFirebaseFirestore();
    if (!db) return;

    const q = query(collection(db, "conges"), where("userId", "==", user.uid), limit(100));

    let first = true;
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRows(
          snap.docs.map((d) => {
            const raw = d.data() as CongeDoc;
            return {
              id: d.id,
              ...raw,
              dateDebut: congeDateToYmd(raw.dateDebut) ?? String(raw.dateDebut ?? ""),
              dateFin: congeDateToYmd(raw.dateFin) ?? String(raw.dateFin ?? ""),
            };
          }),
        );
        if (first) {
          first = false;
          setLoading(false);
        }
      },
      (err) => {
        const msg =
          (err as { code?: string })?.code === "permission-denied"
            ? "Accès refusé (règles Firestore)."
            : "Impossible de charger les congés";
        toast.error(msg);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [user]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => a.dateDebut.localeCompare(b.dateDebut));
    return copy;
  }, [rows]);

  const counts = useMemo(() => {
    let pending = 0;
    let validated = 0;
    for (const r of rows) {
      if (r.statut === "valide") validated += 1;
      else if (r.statut === "en_attente") pending += 1;
    }
    return { pending, validated };
  }, [rows]);

  const v = form.getValues();
  const days = safeBusinessDays(v.dateDebut, v.dateFin);

  const soldeJours = 18;

  async function onSubmit(values: z.infer<typeof schema>) {
    if (!user) return;
    setSubmitting(true);
    try {
      await requestConge({
        userId: user.uid,
        dateDebut: values.dateDebut,
        dateFin: values.dateFin,
        type: values.type as CongeType,
      });
      toast.success("Demande envoyée — visible sur le calendrier (orange = en attente)");
      form.reset({ dateDebut: "", dateFin: "", type: "annuel", motif: "" });
      setTab("calendrier");
    } catch {
      toast.error("Erreur lors de la demande");
    } finally {
      setSubmitting(false);
    }
  }

  const calendarRows: CongeCalendarRow[] = rows;

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Congés & absences</h1>
        <p className="mt-1 text-muted-foreground">
          Calendrier (fériés, maladie, congés), nouvelle demande et suivi — une seule page, données synchronisées.
        </p>
      </div>

      <CongesTabNav tabs={TABS} active={tab} onChange={(id) => setTab(id as TabId)} />

      {tab === "calendrier" ? (
        <AbsenceCalendar
          conges={calendarRows}
          loading={loading}
          includePending
          title="Mon calendrier d'absences"
          description="Les couleurs correspondent à vos demandes ci-dessous : vert = validé, orange = en attente, rose = maladie, violet = jour férié."
        />
      ) : null}

      {tab === "demande" ? (
      <div className="mx-auto max-w-xl">
        <Card className="relative overflow-hidden">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle>Demande de congé</CardTitle>
                <CardDescription>Choisissez les dates et le type</CardDescription>
              </div>
              <div className="inline-flex items-center rounded-full border bg-background px-3 py-1 text-xs font-medium">
                Solde : {soldeJours} jours
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="dateDebut"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date début</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dateFin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date fin</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="rounded-lg border bg-background/60 px-3 py-2 text-sm text-muted-foreground">
                  {days ? <span>Durée calculée: {days} jours ouvrés</span> : <span>Sélectionnez des dates pour calculer la durée.</span>}
                </div>

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type de congé</FormLabel>
                      <FormControl>
                        <div className="flex flex-wrap gap-2">
                          {(["annuel", "maladie", "exceptionnel"] as const).map((t) => {
                            const active = field.value === t;
                            return (
                              <button
                                key={t}
                                type="button"
                                onClick={() => field.onChange(t)}
                                className={
                                  active
                                    ? "rounded-full border bg-muted px-4 py-2 text-sm font-medium"
                                    : "rounded-full border bg-background px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
                                }
                              >
                                {typeLabel(t)}
                              </button>
                            );
                          })}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="motif"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Motif (optionnel)</FormLabel>
                      <FormControl>
                        <textarea
                          className="min-h-24 w-full resize-none rounded-md border bg-background px-3 py-2 text-sm"
                          placeholder="Vacances d'été..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? "Envoi..." : "Envoyer la demande"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
      ) : null}

      {tab === "historique" ? (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle>Mes demandes</CardTitle>
                <CardDescription>{loading ? "Chargement..." : `${sorted.length} demande(s)`}</CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => toast.message("Export PDF", { description: "À brancher: impression (window.print) ou génération PDF." })}
              >
                Exporter PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-background/60 p-3">
                  <div className="text-xs text-muted-foreground">Solde restant</div>
                  <div className="mt-1 text-2xl font-bold">{soldeJours} j</div>
                </div>
                <div className="rounded-lg border bg-background/60 p-3">
                  <div className="text-xs text-muted-foreground">En attente</div>
                  <div className="mt-1 text-2xl font-bold">{counts.pending}</div>
                </div>
                <div className="rounded-lg border bg-background/60 p-3">
                  <div className="text-xs text-muted-foreground">Validés</div>
                  <div className="mt-1 text-2xl font-bold">{counts.validated}</div>
                </div>
              </div>

              <div className="divide-y rounded-lg border">
                {sorted.map((r) => {
                  const s = statutStyle(r.statut);
                  const nb = safeBusinessDays(r.dateDebut, r.dateFin);
                  return (
                    <div key={r.id} className="flex items-start gap-3 p-3">
                      <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-medium">
                            {r.dateDebut} → {r.dateFin}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full border bg-background px-3 py-1 text-xs font-medium">
                              {typeLabel(r.type as CongeType)}
                            </span>
                            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${s.pill}`}>{statutLabel(r.statut)}</span>
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">{nb ? `${nb} jours` : "Durée —"}</div>
                      </div>
                    </div>
                  );
                })}
                {!loading && sorted.length === 0 ? <div className="p-6 text-sm text-muted-foreground">Aucune demande.</div> : null}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

