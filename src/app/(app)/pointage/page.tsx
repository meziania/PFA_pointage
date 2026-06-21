"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { createPointage, getGeofenceZone } from "@/lib/user-management";
import { apiErrorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";
import type { PointageType } from "@/lib/data-model";
import { cn } from "@/lib/utils";

type Geo = { latitude: number; longitude: number; accuracyM?: number };
type Geofence = { latitude: number; longitude: number; rayon_metres: number };

const Html5QrcodeScanner = dynamic(async () => (await import("@/components/app/qr-scanner")).QrScanner, {
  ssr: false,
});

function geolocationMessage(err: unknown): string {
  const anyErr = err as { code?: number; message?: string } | null;
  const code = anyErr?.code;
  if (code === 1) return "GPS refusé — autorisez la localisation";
  if (code === 2) return "Position indisponible";
  if (code === 3) return "GPS trop lent — réessayez";
  return "Erreur GPS";
}

function getCurrentPosition(options: PositionOptions): Promise<Geo> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("GPS non supporté"));
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

function StepBadge({ step, label, done, active }: { step: number; label: string; done: boolean; active: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 text-center">
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
          done && "bg-zone-ok text-white",
          active && !done && "bg-brand text-white",
          !done && !active && "border border-border bg-muted text-muted-foreground",
        )}
      >
        {done ? "✓" : step}
      </div>
      <span className={cn("text-[11px] font-medium", active ? "text-brand-dark" : "text-muted-foreground")}>{label}</span>
    </div>
  );
}

export default function PointagePage() {
  const { user } = useAuth();
  const [geo, setGeo] = useState<Geo | null>(null);
  const [geofence, setGeofence] = useState<Geofence | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [qr, setQr] = useState("");
  const [qrSource, setQrSource] = useState<"scan" | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const lastQrToastRef = useRef<{ text: string; at: number } | null>(null);
  const qrTrimmed = useMemo(() => qr.trim(), [qr]);

  const orgLat = geofence?.latitude ?? parseEnvNumber(process.env.NEXT_PUBLIC_ORG_LAT);
  const orgLon = geofence?.longitude ?? parseEnvNumber(process.env.NEXT_PUBLIC_ORG_LON);
  const orgRadiusM = geofence?.rayon_metres ?? parseEnvNumber(process.env.NEXT_PUBLIC_ORG_RADIUS_M);

  useEffect(() => {
    void (async () => {
      try {
        const res = await getGeofenceZone();
        if (res.geofence) setGeofence(res.geofence);
      } catch {
        // fallback env côté client
      }
    })();
  }, []);

  const distanceM = useMemo(() => {
    if (!geo || orgLat === null || orgLon === null) return null;
    return haversineMeters(orgLat, orgLon, geo.latitude, geo.longitude);
  }, [geo, orgLat, orgLon]);

  const inZone = useMemo(() => {
    if (distanceM === null || orgRadiusM === null) return null;
    return distanceM <= orgRadiusM;
  }, [distanceM, orgRadiusM]);

  const gpsOk = Boolean(geo && inZone !== false);
  const qrOk = Boolean(qrTrimmed && qrSource === "scan");

  const canPoint = useMemo(
    () => Boolean(geo && qrTrimmed && qrSource === "scan" && !saving && inZone === true),
    [geo, qrTrimmed, qrSource, saving, inZone],
  );

  const zoneLabel = useMemo(() => {
    if (!geo) return "Étape 1 — Activez le GPS";
    if (inZone === true) return "Dans la zone autorisée";
    if (inZone === false) return "Hors zone — rapprochez-vous";
    return "Zone non configurée";
  }, [geo, inZone]);

  const handleGetGeo = useCallback(async () => {
    setGeoLoading(true);
    try {
      const quick = await getCurrentPosition({ enableHighAccuracy: false, timeout: 5000, maximumAge: 60_000 }).catch(
        () => null,
      );
      if (quick) {
        setGeo(quick);
        return;
      }
      const g = await getCurrentPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
      setGeo(g);
    } catch (err) {
      toast.error(geolocationMessage(err));
    } finally {
      setGeoLoading(false);
    }
  }, []);

  const handleQrDecoded = useCallback((text: string) => {
    const clean = String(text ?? "").trim();
    if (!clean) return;
    setQr(clean);
    setQrSource("scan");
    const now = Date.now();
    const last = lastQrToastRef.current;
    if (!last || last.text !== clean || now - last.at > 2000) {
      toast.success("QR scanné — validation serveur à l'envoi", { id: "qr-detected" });
      lastQrToastRef.current = { text: clean, at: now };
    }
    setScanning(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!user || !geo) return;
    setSaving(true);
    try {
      if (!qrTrimmed || qrSource !== "scan") {
        toast.error("Scannez le QR affiché à l'entrée");
        return;
      }
      if (inZone !== true) {
        toast.error("Vous devez être dans la zone autorisée");
        return;
      }
      const payload = await createPointage({ latitude: geo.latitude, longitude: geo.longitude, qr: qrTrimmed });
      const type = payload.type as PointageType | undefined;
      toast.success(type === "sortie" ? "Sortie enregistrée" : "Entrée enregistrée");
      setQr("");
      setQrSource(null);
      setScanning(false);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Pointage refusé"));
    } finally {
      setSaving(false);
    }
  }, [geo, user, qrTrimmed, qrSource, inZone]);

  if (!user) return null;

  return (
    <div className="-mx-3 flex min-h-[calc(100dvh-8rem)] flex-col sm:mx-0 sm:min-h-0">
      <div className="border-b border-border bg-card px-3 py-3 sm:px-4">
        <div className="mb-3 text-center text-xs text-muted-foreground">Pointage sécurisé · GPS + QR dynamique</div>
        <div className="flex gap-2">
          <StepBadge step={1} label="GPS" done={gpsOk} active={!gpsOk} />
          <div className="mt-4 h-px flex-1 self-start bg-border" />
          <StepBadge step={2} label="Scan QR" done={qrOk} active={gpsOk && !qrOk} />
          <div className="mt-4 h-px flex-1 self-start bg-border" />
          <StepBadge step={3} label="Pointer" done={false} active={gpsOk && qrOk} />
        </div>
      </div>

      <div
        className={cn(
          "px-4 py-5 text-center text-white sm:rounded-lg",
          !geo && "bg-brand-dark",
          geo && inZone === true && "bg-zone-ok",
          geo && inZone === false && "bg-zone-bad",
          geo && inZone === null && "bg-brand-dark",
        )}
      >
        <div className="font-heading text-2xl tracking-tight">{zoneLabel}</div>
        {geo && distanceM !== null && orgRadiusM !== null ? (
          <div className="mt-1 text-sm tabular-data opacity-90">
            {Math.round(distanceM)} m / {Math.round(orgRadiusM)} m max
            {geo.accuracyM ? ` · précision ±${Math.round(geo.accuracyM)} m` : ""}
          </div>
        ) : null}
        {!geo ? (
          <Button
            type="button"
            size="lg"
            className="mt-4 h-12 min-w-[220px] bg-white text-brand-dark hover:bg-brand-light"
            onClick={() => void handleGetGeo()}
            disabled={geoLoading || saving}
          >
            {geoLoading ? "Localisation…" : "Activer le GPS"}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 px-2 py-4 sm:px-4">
        {geo && inZone === false ? (
          <p className="text-center text-sm text-status-rejected-text">Rapprochez-vous du site pour continuer.</p>
        ) : null}

        <div className="rounded-md border border-border bg-card p-3">
          <div className="mb-2 font-medium text-brand-dark">Étape 2 — Scanner le QR</div>
          <p className="mb-3 text-xs text-muted-foreground">
            Dirigez la caméra vers le QR affiché par l&apos;administrateur à l&apos;entrée. Le token est validé côté
            serveur (expiration 30 s).
          </p>
          <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2.5">
            <span className="text-sm text-muted-foreground">QR détecté</span>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                qrTrimmed ? "bg-status-approved-bg text-status-approved-text" : "bg-muted text-muted-foreground",
              )}
            >
              {qrTrimmed ? "OK" : "En attente"}
            </span>
          </div>
        </div>

        {scanning ? (
          <div className="overflow-hidden rounded-md border border-border bg-card p-2">
            <Html5QrcodeScanner onDecoded={handleQrDecoded} />
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full border-brand/30 text-base"
            onClick={() => setScanning(true)}
            disabled={saving || !geo || inZone === false}
          >
            {qrTrimmed ? "Rescanner le QR" : "Ouvrir la caméra"}
          </Button>
        )}

        <div className="hidden sm:block sm:pt-2">
          <Button type="button" className="h-12 w-full text-base" disabled={!canPoint} onClick={() => void handleSave()}>
            {saving ? "Validation serveur…" : "Étape 3 — Pointer maintenant"}
          </Button>
        </div>
      </div>

      <div className="fixed inset-x-0 fixed-bottom-action z-30 border-t border-border bg-card/95 p-3 backdrop-blur-sm sm:hidden">
        <Button
          type="button"
          className="h-14 w-full max-w-lg mx-auto text-lg font-semibold touch-target"
          disabled={!canPoint}
          onClick={() => void handleSave()}
        >
          {saving ? "Validation…" : "Pointer"}
        </Button>
      </div>
    </div>
  );
}
