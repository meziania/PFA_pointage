"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { httpsCallable } from "firebase/functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/providers/auth-provider";
import { getFirebaseFunctions } from "@/lib/firebase-functions";
import type { PointageType } from "@/lib/data-model";

type Geo = { latitude: number; longitude: number; accuracyM?: number };

const Html5QrcodeScanner = dynamic(async () => (await import("@/components/app/qr-scanner")).QrScanner, {
  ssr: false,
});

function geolocationMessage(err: unknown): string {
  const anyErr = err as { code?: number; message?: string } | null;
  const code = anyErr?.code;
  if (code === 1) return "Autorisation GPS refusée. Activez la localisation puis réessayez.";
  if (code === 2) return "Position indisponible. Vérifiez la connexion/GPS.";
  if (code === 3) return "La géolocalisation a pris trop de temps. Réessayez.";
  return "Impossible de récupérer la géolocalisation.";
}

function getCurrentPosition(options: PositionOptions): Promise<Geo> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Géolocalisation non supportée"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyM: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : undefined,
        }),
      (err) => reject(err),
      options,
    );
  });
}

function parseEnvNumber(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function haversineMeters(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return "—";
  if (meters >= 1000) return `~${(meters / 1000).toFixed(1)} km`;
  return `~${Math.round(meters)} m`;
}

export default function PointagePage() {
  const { user } = useAuth();
  const [geo, setGeo] = useState<Geo | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoHint, setGeoHint] = useState<string>("");
  const [qr, setQr] = useState<string>("");
  const [qrSource, setQrSource] = useState<"scan" | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const lastQrToastRef = useRef<{ text: string; at: number } | null>(null);
  const qrTrimmed = useMemo(() => qr.trim(), [qr]);
  const step = useMemo(() => {
    if (!geo) return 1;
    if (!qrTrimmed) return 2;
    return 3;
  }, [geo, qrTrimmed]);

  const orgLat = useMemo(() => parseEnvNumber(process.env.NEXT_PUBLIC_ORG_LAT), []);
  const orgLon = useMemo(() => parseEnvNumber(process.env.NEXT_PUBLIC_ORG_LON), []);
  const orgRadiusM = useMemo(() => parseEnvNumber(process.env.NEXT_PUBLIC_ORG_RADIUS_M), []);

  const distanceM = useMemo(() => {
    if (!geo) return null;
    if (orgLat === null || orgLon === null) return null;
    return haversineMeters(orgLat, orgLon, geo.latitude, geo.longitude);
  }, [geo, orgLat, orgLon]);

  const inZone = useMemo(() => {
    if (distanceM === null) return null;
    if (orgRadiusM === null) return null;
    return distanceM <= orgRadiusM;
  }, [distanceM, orgRadiusM]);

  const canPoint = useMemo(
    () => Boolean(geo && qrTrimmed && qrSource === "scan" && !saving && inZone !== false),
    [geo, qrTrimmed, qrSource, saving, inZone],
  );

  const handleGetGeo = useCallback(async () => {
    setGeoLoading(true);
    setGeoHint("Récupération de votre position…");
    try {
      // 1) Rapide: position récente (cache) si disponible
      const quick = await getCurrentPosition({ enableHighAccuracy: false, timeout: 5000, maximumAge: 60_000 }).catch(() => null);
      if (quick) {
        setGeo(quick);
        setGeoHint("Position récupérée (rapide).");
        toast.success("Position récupérée");
        return;
      }

      // 2) Précis: GPS haute précision (peut prendre plus de temps)
      setGeoHint("Recherche GPS précise… (ça peut prendre quelques secondes)");
      const g = await getCurrentPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
      setGeo(g);
      setGeoHint("Position récupérée.");
      toast.success("Position récupérée");
    } catch (err) {
      const msg = geolocationMessage(err);
      setGeoHint(msg);
      toast.error(msg);
    } finally {
      setGeoLoading(false);
    }
  }, []);

  const handleQrDecoded = useCallback((text: string) => {
    const clean = String(text ?? "").trim();
    if (!clean) return;
    setQr(clean);
    setQrSource("scan");
    // Dedup toast in case the scanner fires multiple times.
    const now = Date.now();
    const last = lastQrToastRef.current;
    if (!last || last.text !== clean || now - last.at > 2000) {
      toast.success("QR détecté", { id: "qr-detected" });
      lastQrToastRef.current = { text: clean, at: now };
    }
    setScanning(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    try {
      const functions = getFirebaseFunctions();
      if (!functions) {
        toast.error("Firebase n'est pas configuré");
        return;
      }

      const scanned = qr.trim();
      if (!scanned || qrSource !== "scan") {
        toast.error("Scan du QR obligatoire avant de pointer");
        return;
      }

      if (!geo) {
        toast.error("1) Cliquez sur “Récupérer ma position” (GPS) avant de pointer.");
        return;
      }
      const g = geo;
      if (!g) {
        toast.error("La géolocalisation est obligatoire pour pointer");
        return;
      }

      const createPointage = httpsCallable(functions, "createPointage");
      const res = await createPointage({ latitude: g.latitude, longitude: g.longitude, qr: scanned });
      const payload = res.data as { type?: PointageType };

      const type = payload.type;
      toast.success(type === "sortie" ? "Pointage de sortie enregistré" : "Pointage d'entrée enregistré");
      setQr("");
      setQrSource(null);
      setScanning(false);
    } catch (err) {
      const anyErr = err as { code?: string; message?: string; details?: unknown };
      const code = anyErr?.code;
      const msg = typeof anyErr?.message === "string" ? anyErr.message : "";

      if (code === "functions/unauthenticated") {
        toast.error("Session expirée: reconnectez-vous");
      } else if (
        code === "functions/permission-denied" ||
        msg.toLowerCase().includes("outside allowed area") ||
        msg.toLowerCase().includes("invalid qr")
      ) {
        toast.error("Pointage refusé: zone ou QR invalide");
      } else if (code === "functions/invalid-argument") {
        toast.error("Données invalides");
      } else if (code === "functions/failed-precondition") {
        toast.error("Configuration serveur incomplète (token/zone).");
      } else {
        toast.error(msg || "Erreur lors du pointage");
      }
    } finally {
      setSaving(false);
    }
  }, [geo, user, qr, qrSource]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border bg-card p-5 md:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsla(142,71%,45%,0.18),transparent_58%),radial-gradient(ellipse_at_bottom,hsla(217,92%,60%,0.14),transparent_55%)]" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pointage</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              1) GPS → 2) QR → 3) Validation serveur. Rapide, sécurisé, traçable.
            </p>
          </div>

          <div className="grid gap-2 rounded-xl border bg-background/60 p-3 sm:grid-cols-3 sm:gap-0">
            {[
              { n: 1, label: "Position" },
              { n: 2, label: "QR" },
              { n: 3, label: "Pointer" },
            ].map((s) => (
              <div
                key={s.n}
                className={
                  step === s.n
                    ? "flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                    : step > s.n
                      ? "flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-foreground"
                      : "flex items-center justify-center gap-2 px-3 py-2 text-xs text-muted-foreground"
                }
              >
                <span
                  className={
                    step >= s.n
                      ? "grid h-5 w-5 place-items-center rounded-full bg-primary/15 text-[10px] text-primary"
                      : "grid h-5 w-5 place-items-center rounded-full bg-muted text-[10px] text-muted-foreground"
                  }
                >
                  {step > s.n ? "✓" : s.n}
                </span>
                {s.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle>1) Géolocalisation</CardTitle>
                <CardDescription>Position GPS actuelle</CardDescription>
              </div>
              <div
                className={
                  geo
                    ? "inline-flex items-center gap-2 rounded-full bg-[color-mix(in_oklch,var(--success)_20%,transparent)] px-3 py-1 text-xs font-medium text-foreground"
                    : "inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
                }
              >
                <span className={geo ? "h-2 w-2 rounded-full bg-[var(--color-success)]" : "h-2 w-2 rounded-full bg-muted-foreground/40"} />
                {geo ? "Actif" : "Inactif"}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handleGetGeo} variant="outline" disabled={geoLoading || saving}>
              {geoLoading ? "Récupération..." : "Récupérer ma position"}
            </Button>
            {geoHint ? <div className="text-xs text-muted-foreground">{geoHint}</div> : null}

            {geo ? (
              <>
                <div className="overflow-hidden rounded-lg border bg-card">
                  <div className="relative h-32 bg-[linear-gradient(0deg,color-mix(in_oklch,var(--foreground)_6%,transparent),color-mix(in_oklch,var(--foreground)_6%,transparent)),linear-gradient(90deg,color-mix(in_oklch,var(--foreground)_6%,transparent),color-mix(in_oklch,var(--foreground)_6%,transparent))] bg-[length:40px_40px]">
                    <div
                      className={inZone === false ? "absolute inset-0 bg-[color-mix(in_oklch,var(--destructive)_18%,transparent)]" : "absolute inset-0 bg-[color-mix(in_oklch,var(--success)_18%,transparent)]"}
                    />
                    <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground/10 bg-background/30" />
                    <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground shadow-sm" />
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 translate-y-6 rounded-full border bg-background px-3 py-1 text-xs">
                      {inZone === false ? "Hors zone ✕" : inZone === true ? "Zone autorisée ✓" : "Zone…"}
                    </div>
                  </div>
                  <div className="grid gap-3 p-3 sm:grid-cols-2">
                    <div className="rounded-md border bg-background/60 p-3">
                      <div className="text-xs text-muted-foreground">Latitude</div>
                      <div className="mt-1 font-medium tabular-nums">{geo.latitude.toFixed(4)}°</div>
                    </div>
                    <div className="rounded-md border bg-background/60 p-3">
                      <div className="text-xs text-muted-foreground">Longitude</div>
                      <div className="mt-1 font-medium tabular-nums">{geo.longitude.toFixed(4)}°</div>
                    </div>
                    <div className="sm:col-span-2 rounded-md border bg-background/60 p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">Précision GPS</div>
                        <div className="text-xs text-muted-foreground">
                          {typeof geo.accuracyM === "number" ? `±${Math.round(geo.accuracyM)} m` : "—"}
                        </div>
                      </div>
                      <div className="mt-2 h-2 w-full rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-[var(--color-success)]"
                          style={{
                            width:
                              typeof geo.accuracyM === "number"
                                ? `${Math.max(10, Math.min(100, Math.round((1 - Math.min(geo.accuracyM, 100) / 100) * 100)))}%`
                                : "20%",
                          }}
                        />
                      </div>
                      {distanceM !== null && orgRadiusM !== null ? (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Distance: {formatDistance(distanceM)} · Rayon autorisé: {Math.round(orgRadiusM)} m
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-muted-foreground">Zone autorisée: non configurée côté web.</div>
                      )}
                    </div>
                  </div>
                </div>

                <div
                  className={
                    inZone === false
                      ? "flex items-center justify-between rounded-lg border bg-[color-mix(in_oklch,var(--destructive)_18%,transparent)] p-3"
                      : "flex items-center justify-between rounded-lg border bg-[color-mix(in_oklch,var(--success)_18%,transparent)] p-3"
                  }
                >
                  <div>
                    <div className="text-sm font-medium">
                      {inZone === false ? "Hors zone autorisée" : inZone === true ? "Dans la zone autorisée" : "Zone non vérifiée"}
                    </div>
                    <div className="text-xs text-muted-foreground">Siège social — Casablanca</div>
                  </div>
                  <div
                    className={
                      inZone === false
                        ? "grid h-7 w-7 place-items-center rounded-full bg-[color-mix(in_oklch,var(--destructive)_25%,transparent)] text-sm"
                        : "grid h-7 w-7 place-items-center rounded-full bg-[color-mix(in_oklch,var(--success)_25%,transparent)] text-sm"
                    }
                  >
                    {inZone === false ? "!" : "✓"}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Cliquez sur “Récupérer ma position” pour activer le GPS.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2) QR Code</CardTitle>
            <CardDescription>Scannez le QR code affiché à l’entrée de l’entreprise.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <div className="flex items-center justify-between rounded-xl border bg-background/60 px-3 py-2">
                <div className="text-xs text-muted-foreground">État</div>
                <div
                  className={
                    qrTrimmed
                      ? "inline-flex items-center gap-2 rounded-full bg-[color-mix(in_oklch,var(--success)_18%,transparent)] px-3 py-1 text-xs font-medium"
                      : "inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
                  }
                >
                  <span className={qrTrimmed ? "h-2 w-2 rounded-full bg-[var(--color-success)]" : "h-2 w-2 rounded-full bg-muted-foreground/40"} />
                  {qrTrimmed ? "QR validé" : "En attente"}
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => setScanning((s) => !s)} variant="outline" disabled={saving} className="flex-1">
                  {scanning ? "Fermer" : "Ouvrir la caméra"}
                </Button>
                <Button onClick={handleSave} disabled={!canPoint} className="flex-[2]">
                  {saving ? "Validation..." : "Pointer"}
                </Button>
              </div>
            </div>

            {scanning ? (
              <div className="relative overflow-hidden rounded-xl border p-3">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsla(217,92%,60%,0.10),transparent_60%)]" />
                <Html5QrcodeScanner onDecoded={handleQrDecoded} />
              </div>
            ) : null}

            <div className="rounded-xl border bg-background/60 p-3 text-xs text-muted-foreground">
              Objectif: <span className="font-medium text-foreground">valider votre présence</span> en scannant le QR code sur place.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

