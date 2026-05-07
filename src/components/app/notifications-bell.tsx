"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, getCountFromServer, limit, query, where, getDocs } from "firebase/firestore";
import QRCode from "qrcode";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import { getFirebaseFirestore } from "@/lib/firebase-firestore";
import type { NotificationDoc } from "@/lib/data-model";

type Row = NotificationDoc & { id: string };

function createdAtMs(v: unknown): number {
  const anyV = v as { toMillis?: () => number } | null;
  if (anyV && typeof anyV.toMillis === "function") return anyV.toMillis();
  return 0;
}

function timeAgo(ms: number): string {
  if (!ms) return "";
  const diff = Math.max(0, Date.now() - ms);
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "à l’instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return `il y a ${days} j`;
}

function extractFirstUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s)]+/i);
  return m ? m[0] : null;
}

function stripUrls(text: string): string {
  const t = text ?? "";
  // Remove any URLs + preceding "Lien:" marker if present.
  return t
    .replace(/Lien:\s*https?:\/\/[^\s)]+/gi, "")
    .replace(/https?:\/\/[^\s)]+/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function downloadDataUrl(filename: string, dataUrl: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function NotificationsBell() {
  const { user } = useAuth();
  const [count, setCount] = useState<number>(0);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  const uid = user?.uid ?? "";
  const db = getFirebaseFirestore();

  const unreadLabel = useMemo(() => (count > 99 ? "99+" : String(count)), [count]);

  useEffect(() => {
    if (!db || !uid) return;
    const q = query(collection(db, "notifications"), where("userId", "==", uid), where("read", "==", false));
    void (async () => {
      try {
        const snap = await getCountFromServer(q);
        setCount(snap.data().count);
      } catch {
        setCount(0);
      }
    })();
  }, [db, uid, open]);

  const loadLatest = useCallback(async () => {
    if (!db || !uid) return;
    try {
      // Avoid composite indexes: no orderBy here (sort client-side).
      const q = query(collection(db, "notifications"), where("userId", "==", uid), limit(25));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as NotificationDoc) }));
      list.sort((a, b) => createdAtMs(b.createdAt) - createdAtMs(a.createdAt));
      setRows(list.slice(0, 10));
    } catch (err) {
      const anyErr = err as { code?: unknown; message?: unknown } | null;
      const code = typeof anyErr?.code === "string" ? anyErr.code : "";
      if (code.includes("permission-denied")) {
        toast.error("Accès refusé aux notifications (Firestore rules)");
      } else {
        toast.error("Impossible de charger les notifications");
      }
    }
  }, [db, uid]);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => void loadLatest());
  }, [open, loadLatest]);

  if (!uid) return null;

  return (
    <div className="relative">
      <button
        type="button"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        <span className={count > 0 ? "relative" : ""}>🔔</span>
        {count > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {unreadLabel}
          </span>
        ) : null}
        {count > 0 ? (
          <span className="pointer-events-none absolute inset-0 rounded-md ring-1 ring-primary/20 animate-pulse" />
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-[min(360px,92vw)] overflow-hidden rounded-xl border bg-background shadow-lg">
          <div className="relative border-b px-3 py-3">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsla(217,92%,60%,0.16),transparent_65%),radial-gradient(ellipse_at_bottom,hsla(142,71%,45%,0.14),transparent_60%)]" />
            <div className="relative flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Notifications</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {count > 0 ? `${count} non lue(s)` : "Tout est à jour"}
                </div>
              </div>
              <button
                type="button"
                className="relative inline-flex items-center gap-2 rounded-md border bg-background/70 px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => void loadLatest()}
              >
                ⟳ Rafraîchir
              </button>
            </div>
          </div>
          <div className="max-h-80 overflow-auto">
            {rows.length === 0 ? (
              <div className="px-3 py-6">
                <div className="rounded-xl border bg-background/60 p-4 text-sm">
                  <div className="font-medium">Aucune notification</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Quand l’admin génère un nouveau QR, tu le verras ici.
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2 p-2">
                {rows.map((n) => {
                  const ms = createdAtMs(n.createdAt);
                  const ago = timeAgo(ms);
                  const url = typeof n.qrLink === "string" && n.qrLink.trim() ? n.qrLink.trim() : extractFirstUrl(n.body ?? "");
                  const isUnread = n.read === false;
                  const cleaned = stripUrls(n.body ?? "");
                  const safeBody = cleaned || "Un nouveau QR de pointage est disponible.";
                  return (
                    <div
                      key={n.id}
                      className={
                        isUnread
                          ? "relative overflow-hidden rounded-xl border bg-[color-mix(in_oklch,var(--primary)_6%,transparent)] p-3"
                          : "relative overflow-hidden rounded-xl border bg-background/60 p-3"
                      }
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="truncate text-sm font-semibold">{n.title}</div>
                            {isUnread ? (
                              <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                Nouveau
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap break-words">
                            {safeBody}
                          </div>
                        </div>
                        <div className="shrink-0 text-[10px] text-muted-foreground">{ago}</div>
                      </div>

                      {url ? (
                        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border bg-background/70 px-2 py-1.5">
                          <div className="text-[11px] text-muted-foreground">QR prêt à télécharger</div>
                          <button
                            type="button"
                            className="shrink-0 rounded-md border bg-background px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                            onClick={async () => {
                              try {
                                const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 512 });
                                downloadDataUrl(`qr-pointage-${new Date().toISOString().slice(0, 10)}.png`, dataUrl);
                                toast.success("QR téléchargé");
                              } catch {
                                toast.error("Impossible de générer le QR");
                              }
                            }}
                          >
                            Télécharger QR
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="border-t px-3 py-2 text-xs text-muted-foreground">
            Astuce: garde le GPS actif pour pointer.
          </div>
        </div>
      ) : null}
    </div>
  );
}

