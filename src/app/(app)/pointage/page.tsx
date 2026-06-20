"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { createPointage } from "@/lib/user-management";
import { apiErrorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";
import type { PointageType } from "@/lib/data-model";
import { cn } from "@/lib/utils";

type Geo = { latitude: number; longitude: number; accuracyM?: number };

const Html5QrcodeScanner = dynamic(async () => (await import("@/components/app/qr-scanner")).QrScanner, {
  ssr: false,
});

function geolocationMessage(err: unknown): string {
  const anyErr = err as { code?: number; message?: string } | null;
  const code = anyErr?.code;
  if (code === 1) return "GPS refusé";
  if (code === 2) return "Position indisponible";
  if (code === 3) return "GPS trop lent";
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

export default function PointagePage() {
  const { user } = useAuth();
  const [geo, setGeo] = useState<Geo | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [qr, setQr] = useState<string>("");
  const [qrSource, setQrSource] = useState<"scan" | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const lastQrToastRef = useRef<{ text: string; at: number } | null>(null);
  const qrTrimmed = useMemo(() => qr.trim(), [qr]);

  const orgLat = useMemo(() => parseEnvNumber(process.env.NEXT_PUBLIC_ORG_LAT), []);
  const orgLon = useMemo(() => parseEnvNumber(process.env.NEXT_PUBLIC_ORG_LON), []);
  const orgRadiusM = useMemo(() => parseEnvNumber(process.env.NEXT_PUBLIC_ORG_RADIUS_M), []);

  const distanceM = useMemo(() => {
    if (!geo || orgLat === null || orgLon === null) return null;
    return haversineMeters(orgLat, orgLon, geo.latitude, geo.longitude);
  }, [geo, orgLat, orgLon]);

  const inZone = useMemo(() => {
    if (distanceM === null || orgRadiusM === null) return null;
    return distanceM <= orgRadiusM;
  }, [distanceM, orgRadiusM]);

  const canPoint = useMemo(
    () => Boolean(geo && qrTrimmed && qrSource === "scan" && !saving && inZone !== false),
    [geo, qrTrimmed, qrSource, saving, inZone],
  );

  const zoneLabel = useMemo(() => {
    if (!geo) return "Activez le GPS";
    if (inZone === true) return "Dans la zone";
    if (inZone === false) return "Hors zone";
    return "Zone non configurée";
  }, [geo, inZone]);

  const handleGetGeo = useCallback(async () => {
    setGeoLoading(true);
    try {
      const quick = await getCurrentPosition({ enableHighAccuracy: false, timeout: 5000, maximumAge: 60_000 }).catch(() => null);
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
      toast.success("QR OK", { id: "qr-detected" });
      lastQrToastRef.current = { text: clean, at: now };
    }
    setScanning(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!user || !geo) return;
    setSaving(true);
    try {
      if (!qrTrimmed || qrSource !== "scan") {
        toast.error("Scannez le QR d'abord");
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
  }, [geo, user, qrTrimmed, qrSource]);

  if (!user) return null;

  return (
    <div className="-mx-4 flex min-h-[calc(100dvh-8rem)] flex-col sm:mx-0 sm:min-h-0">
      {/* Zone GPS — contraste fort, lisible en extérieur */}
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
          <div className="mt-1 text-sm tabular-data opacity-90">{Math.round(distanceM)} m / {Math.round(orgRadiusM)} m</div>
        ) : null}
        {!geo ? (
          <Button
            type="button"
            size="lg"
            className="mt-4 h-12 min-w-[220px] bg-white text-brand-dark hover:bg-brand-light"
            onClick={() => void handleGetGeo()}
            disabled={geoLoading || saving}
          >
            {geoLoading ? "GPS…" : "Activer le GPS"}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 py-4 pb-28 sm:pb-4">
        {geo && inZone === false ? (
          <p className="text-center text-sm text-status-rejected-text">Rapprochez-vous du site pour pointer.</p>
        ) : null}

        <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2.5">
          <span className="text-sm text-muted-foreground">QR scanné</span>
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
              qrTrimmed ? "bg-status-approved-bg text-status-approved-text" : "bg-muted text-muted-foreground",
            )}
          >
            {qrTrimmed ? "OK" : "Non"}
          </span>
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
            disabled={saving || !geo}
          >
            {qrTrimmed ? "Rescanner le QR" : "Scanner le QR"}
          </Button>
        )}

        <div className="hidden sm:block sm:pt-2">
          <Button type="button" className="h-12 w-full text-base" disabled={!canPoint} onClick={() => void handleSave()}>
            {saving ? "Envoi…" : "Pointer maintenant"}
          </Button>
        </div>
      </div>

      {/* Barre fixe mobile — un seul gros bouton */}
      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 p-4 backdrop-blur-sm sm:hidden">
        <Button
          type="button"
          className="h-14 w-full text-lg font-semibold"
          disabled={!canPoint}
          onClick={() => void handleSave()}
        >
          {saving ? "Validation…" : "Pointer"}
        </Button>
      </div>
    </div>
  );
}
