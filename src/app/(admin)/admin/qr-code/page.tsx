"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiErrorMessage, getCurrentQr, type DynamicQrPayload } from "@/lib/user-management";

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
  const [payload, setPayload] = useState<DynamicQrPayload | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const fetchingRef = useRef(false);

  const qrLink = payload?.qrLink ?? "";
  const token = payload?.token ?? "";

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
        const url = await QRCode.toDataURL(qrLink, { margin: 1, width: 512 });
        setQrDataUrl(url);
      } catch {
        setQrDataUrl("");
      }
    })();
  }, [qrLink]);

  const progress = useMemo(() => {
    const windowMs = payload?.windowMs ?? 30_000;
    return Math.round((secondsLeft / (windowMs / 1000)) * 100);
  }, [payload?.windowMs, secondsLeft]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl text-brand-dark md:text-2xl">QR code dynamique</h1>
        <p className="text-muted-foreground">
          Le QR change automatiquement toutes les 30 secondes. Affichez cet écran sur un poste admin à l&apos;entrée :
          les employés scannent le code en direct.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fenêtre courante</CardTitle>
          <CardDescription>
            Token HMAC rotatif — validation côté serveur avec tolérance d&apos;une fenêtre précédente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div
              className="relative flex h-24 w-24 items-center justify-center rounded-full border-4 border-primary/20"
              style={{
                background: `conic-gradient(hsl(var(--primary)) ${progress}%, transparent ${progress}%)`,
              }}
            >
              <div className="flex h-[4.5rem] w-[4.5rem] flex-col items-center justify-center rounded-full bg-background">
                <span className="text-2xl font-bold tabular-nums">{secondsLeft}</span>
                <span className="text-[10px] text-muted-foreground">sec</span>
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="text-sm text-muted-foreground">Prochain renouvellement dans {secondsLeft} s</div>
              <div className="text-xs text-muted-foreground">Mode : dynamique (30 s)</div>
              {payload ? (
                <div className="text-xs text-muted-foreground">
                  Expire à : {new Date(payload.windowEndsAtMs).toLocaleTimeString()}
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="mb-1 text-sm text-muted-foreground">Token courant</div>
              <Input value={token} readOnly placeholder={loading ? "Chargement…" : "(indisponible)"} />
              <div className="mt-2 text-xs text-muted-foreground break-all">
                Lien : {qrLink || "—"}
              </div>
            </div>

            <div className="flex items-center justify-center rounded-lg border bg-background p-4">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="QR code dynamique" className="h-56 w-56 rounded-md border bg-white p-2" />
              ) : (
                <div className="text-sm text-muted-foreground">{loading ? "Chargement…" : "Aucun QR"}</div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => void fetchQr()} disabled={loading}>
              Rafraîchir maintenant
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!qrLink}
              onClick={async () => {
                try {
                  if (!qrLink) return;
                  await navigator.clipboard.writeText(qrLink);
                  toast.success("Lien copié");
                } catch {
                  toast.error("Impossible de copier le lien");
                }
              }}
            >
              Copier le lien
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!qrDataUrl}
              onClick={() => downloadDataUrl(`qr-pointage-${new Date().toISOString().slice(0, 19)}.png`, qrDataUrl)}
            >
              Télécharger le QR (PNG)
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            La sécurité repose sur la rotation 30 s, la validation serveur et la zone GPS. Ne partagez pas le secret QR
            (`settings/pointage.qrSecret`) — seul le token de la fenêtre courante est affiché ici.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
