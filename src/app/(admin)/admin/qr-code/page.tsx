"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { httpsCallable } from "firebase/functions";
import { toast } from "sonner";
import { doc, getDoc } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getFirebaseFunctions } from "@/lib/firebase-functions";
import { getFirebaseFirestore } from "@/lib/firebase-firestore";

type SettingsDoc = {
  qrToken?: unknown;
  qrTokenHash?: unknown;
  qrExpiresAt?: { toMillis?: () => number } | null;
  updatedAt?: { toMillis?: () => number } | null;
};

function downloadDataUrl(filename: string, dataUrl: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function formatDateTime(ms: number | null | undefined): string {
  if (!ms || !Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleString();
}

export default function AdminQrCodePage() {
  const [loading, setLoading] = useState(true);
  const [rotating, setRotating] = useState(false);
  const [token, setToken] = useState("");
  const [expiresAtMs, setExpiresAtMs] = useState<number | null>(null);
  const [updatedAtMs, setUpdatedAtMs] = useState<number | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [nowMs, setNowMs] = useState(() => Date.now());

  const origin = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  const qrText = useMemo(() => token.trim(), [token]);
  const qrLink = useMemo(() => (qrText && origin ? `${origin}/pointage?token=${encodeURIComponent(qrText)}` : ""), [origin, qrText]);

  async function refresh() {
    const db = getFirebaseFirestore();
    if (!db) return;
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "settings", "pointage"));
      if (!snap.exists()) {
        setToken("");
        setExpiresAtMs(null);
        setUpdatedAtMs(null);
        setQrDataUrl("");
        return;
      }
      const data = snap.data() as SettingsDoc;
      // Token is not stored in Firestore anymore (hash only). Only the admin who generates gets the token.
      // We keep a legacy fallback in case some environments still have qrToken stored.
      const t = typeof data.qrToken === "string" ? data.qrToken : "";
      const exp = typeof data.qrExpiresAt?.toMillis === "function" ? data.qrExpiresAt.toMillis() : null;
      const upd = typeof data.updatedAt?.toMillis === "function" ? data.updatedAt.toMillis() : null;
      setToken(t);
      setExpiresAtMs(exp);
      setUpdatedAtMs(upd);
    } catch (err) {
      const anyErr = err as { code?: unknown; message?: unknown } | null;
      const code = typeof anyErr?.code === "string" ? anyErr.code : "";
      const msg = typeof anyErr?.message === "string" ? anyErr.message : "";
      if (code.includes("permission-denied")) {
        toast.error("Accès refusé (Firestore rules). Déploie `firestore.rules` puis réessaie.");
      } else {
        toast.error(`Impossible de charger la configuration QR${code ? ` (${code})` : ""}${msg ? `: ${msg}` : ""}`);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Avoid calling setState synchronously inside effects (project lint rule).
    queueMicrotask(() => void refresh());
  }, []);

  useEffect(() => {
    void (async () => {
      if (!qrLink) return;
      try {
        const url = await QRCode.toDataURL(qrLink, { margin: 1, width: 512 });
        setQrDataUrl(url);
      } catch {
        setQrDataUrl("");
      }
    })();
  }, [qrLink]);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  async function rotateWeekly() {
    setRotating(true);
    try {
      const functions = getFirebaseFunctions();
      if (!functions) {
        toast.error("Firebase Functions non configuré");
        return;
      }
      const fn = httpsCallable(functions, "rotatePointageQrWeekly");
      const res = await fn({});
      const data = res.data as { token?: unknown; expiresAtMs?: unknown };
      const t = typeof data.token === "string" ? data.token : "";
      const exp = typeof data.expiresAtMs === "number" ? data.expiresAtMs : null;
      if (!t) throw new Error("Token vide");
      setToken(t);
      setExpiresAtMs(exp);
      setUpdatedAtMs(Date.now());
      toast.success("Nouveau QR généré (hebdomadaire)");
    } catch {
      toast.error("Impossible de générer un nouveau QR");
    } finally {
      setRotating(false);
    }
  }

  async function notifyEmployees() {
    try {
      const functions = getFirebaseFunctions();
      if (!functions) {
        toast.error("Firebase Functions non configuré");
        return;
      }
      const fn = httpsCallable(functions, "notifyEmployeesNewQr");
      const res = await fn({ link: qrLink, tokenExpiresAtMs: expiresAtMs });
      const data = res.data as { sent?: unknown };
      const sent = typeof data.sent === "number" ? data.sent : 0;
      toast.success(`Notification envoyée à ${sent} employé(s)`);
    } catch {
      toast.error("Impossible d'envoyer les notifications");
    }
  }

  const expired = useMemo(() => {
    if (!expiresAtMs) return false;
    return nowMs > expiresAtMs;
  }, [expiresAtMs, nowMs]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">QR code (rotation)</h1>
        <p className="text-muted-foreground">
          Générer un QR “modifiable” (rotation hebdomadaire). Les employés scannent ce QR lors du pointage, et le serveur valide le token.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Token courant</CardTitle>
          <CardDescription>Stocké dans Firestore: `settings/pointage`.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="mb-1 text-sm text-muted-foreground">Token (à distribuer)</div>
              <Input value={token} readOnly placeholder={loading ? "Chargement…" : "(non défini)"} />
              <div className="mt-2 text-xs text-muted-foreground">
                Lien QR: <span className="font-medium">{qrLink ? "OK" : "—"}</span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Mis à jour: <span className="font-medium">{formatDateTime(updatedAtMs)}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Expire: <span className={expired ? "font-medium text-destructive" : "font-medium"}>{formatDateTime(expiresAtMs)}</span>
              </div>
            </div>

            <div className="flex items-center justify-center rounded-lg border bg-background p-4">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="QR code" className="h-56 w-56 rounded-md border bg-white p-2" />
              ) : (
                <div className="text-sm text-muted-foreground">{loading ? "Chargement…" : "Aucun QR"}</div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={rotateWeekly} disabled={rotating}>
              {rotating ? "Génération..." : "Générer un nouveau QR (7 jours)"}
            </Button>
            <Button type="button" variant="outline" onClick={() => void refresh()} disabled={loading || rotating}>
              Rafraîchir
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
            <Button type="button" variant="outline" disabled={!qrLink} onClick={() => void notifyEmployees()}>
              Notifier les employés (in-app)
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!qrDataUrl}
              onClick={() => downloadDataUrl(`qr-pointage-${new Date().toISOString().slice(0, 10)}.png`, qrDataUrl)}
            >
              Télécharger le QR (PNG)
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            Distribution: tu peux envoyer ce PNG ou le lien aux employés (email/WhatsApp/intranet). La sécurité reste assurée par la <span className="font-medium">validation backend</span> + la{" "}
            <span className="font-medium">zone GPS</span>.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

