"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiErrorMessage, getCurrentQr, initDynamicQr, type DynamicQrPayload } from "@/lib/user-management";

function downloadDataUrl(filename: string, dataUrl: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function AdminQrCodePage() {
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [payload, setPayload] = useState<DynamicQrPayload | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [kiosk, setKiosk] = useState(false);
  const fetchingRef = useRef(false);
  const kioskRef = useRef<HTMLDivElement>(null);

  const qrLink = payload?.qrLink ?? "";

  const fetchQr = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const data = await getCurrentQr();
      setPayload(data);
      setSecondsLeft(data.secondsRemaining);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Impossible de charger le QR dynamique."));
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchQr();
  }, [fetchQr]);

  useEffect(() => {
    const tick = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!payload) return;
    const remaining = Math.max(0, Math.ceil((payload.windowEndsAtMs - nowMs) / 1000));
    setSecondsLeft(remaining);
    if (remaining <= 0) {
      void fetchQr();
    }
  }, [fetchQr, nowMs, payload]);

  useEffect(() => {
    void (async () => {
      if (!qrLink) {
        setQrDataUrl("");
        return;
      }
      try {
        const url = await QRCode.toDataURL(qrLink, { margin: 1, width: 640, errorCorrectionLevel: "M" });
        setQrDataUrl(url);
      } catch {
        setQrDataUrl("");
      }
    })();
  }, [qrLink]);

  useEffect(() => {
    if (!kiosk) return;
    const el = kioskRef.current;
    if (!el) return;
    void el.requestFullscreen?.().catch(() => setKiosk(false));
    const onExit = () => {
      if (!document.fullscreenElement) setKiosk(false);
    };
    document.addEventListener("fullscreenchange", onExit);
    return () => {
      document.removeEventListener("fullscreenchange", onExit);
      if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
    };
  }, [kiosk]);

  const progress = useMemo(() => {
    const windowMs = payload?.windowMs ?? 30_000;
    return Math.round((secondsLeft / (windowMs / 1000)) * 100);
  }, [payload?.windowMs, secondsLeft]);

  async function handleInitQr() {
    setInitializing(true);
    try {
      await initDynamicQr();
      toast.success("Mode QR dynamique activé");
      await fetchQr();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Impossible d'initialiser le QR."));
    } finally {
      setInitializing(false);
    }
  }

  const displayPanel = (
    <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-center">
      <div className="flex flex-col items-center gap-4">
        <div
          className="relative flex h-28 w-28 items-center justify-center rounded-full border-4 border-primary/25"
          style={{
            background: `conic-gradient(var(--brand) ${progress}%, transparent ${progress}%)`,
          }}
        >
          <div className="flex h-[5.5rem] w-[5.5rem] flex-col items-center justify-center rounded-full bg-card shadow-sm">
            <span className="text-3xl font-bold tabular-nums text-brand-dark">{secondsLeft}</span>
            <span className="text-[11px] text-muted-foreground">secondes</span>
          </div>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Renouvellement automatique · fenêtre de {Math.round((payload?.windowMs ?? 30_000) / 1000)} s
        </p>
      </div>

      <div className="rounded-xl border-2 border-brand/20 bg-white p-4 shadow-sm">
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt="QR code de pointage" className="h-64 w-64 sm:h-72 sm:w-72" />
        ) : (
          <div className="flex h-64 w-64 items-center justify-center text-sm text-muted-foreground sm:h-72 sm:w-72">
            {loading ? "Chargement…" : "QR indisponible"}
          </div>
        )}
      </div>
    </div>
  );

  if (kiosk) {
    return (
      <div ref={kioskRef} className="fixed inset-0 z-50 flex flex-col bg-brand-light">
        <div className="flex items-center justify-between border-b border-brand/15 bg-card px-4 py-3">
          <div>
            <div className="font-heading text-lg text-brand-dark">Pointage — QR du jour</div>
            <div className="text-xs text-muted-foreground">Scannez avec l&apos;application employé · GPS requis</div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setKiosk(false)}>
            Quitter le plein écran
          </Button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">{displayPanel}</div>
        <div className="border-t border-brand/15 bg-card px-4 py-3 text-center text-xs text-muted-foreground">
          TimeTrack Pro · QR sécurisé · Ne photographiez pas ce code pour le partager
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl text-brand-dark md:text-2xl">QR code de pointage</h1>
        <p className="text-muted-foreground">
          Conforme au cahier des charges : QR dynamique (30 s), validation serveur (token + géofencing), affichage
          admin à l&apos;entrée du site.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>Affichage entrée</CardTitle>
              <CardDescription>
                Placez cet écran sur un poste fixe. Les employés ouvrent <strong>Pointer</strong>, activent le GPS
                puis scannent ce code.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => setKiosk(true)} disabled={!qrDataUrl}>
                Mode plein écran
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => void fetchQr()} disabled={loading}>
                Rafraîchir
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">{displayPanel}</CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Flux sécurisé</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                  1
                </span>
                <p>Admin affiche le QR rotatif (token HMAC, fenêtre 30 s).</p>
              </div>
              <div className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                  2
                </span>
                <p>Employé : GPS activé + scan caméra (pas de saisie manuelle).</p>
              </div>
              <div className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                  3
                </span>
                <p>Serveur valide token (fenêtre courante ou précédente) + zone autorisée.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button type="button" variant="outline" size="sm" className="w-full" asChild>
                <Link href="/admin/parametres">Zone GPS (géofencing)</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                disabled={initializing}
                onClick={() => void handleInitQr()}
              >
                {initializing ? "Initialisation…" : "Réinitialiser le secret QR"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Le secret reste côté serveur (`settings/pointage`). Seul le hash de la fenêtre courante est journalisé
                en base.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actions & sécurité</CardTitle>
          <CardDescription>Ne partagez pas le QR par messagerie — il expire rapidement.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            variant="outline"
            disabled={!qrDataUrl}
            onClick={() => downloadDataUrl(`qr-pointage-${new Date().toISOString().slice(0, 19)}.png`, qrDataUrl)}
          >
            Télécharger (PNG)
          </Button>
          {payload ? (
            <div className="text-xs text-muted-foreground sm:self-center">
              Fenêtre expire à {new Date(payload.windowEndsAtMs).toLocaleTimeString("fr-FR")} · mode dynamique actif
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
