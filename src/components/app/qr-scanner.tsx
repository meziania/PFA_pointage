"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

export function QrScanner({ onDecoded }: { onDecoded: (text: string) => void }) {
  const [elementId] = useState(() => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `qr_${crypto.randomUUID()}`;
    return `qr_${Date.now().toString(16)}`;
  });
  const qrRef = useRef<Html5Qrcode | null>(null);
  const startedRef = useRef(false);
  const lastRef = useRef<{ text: string; at: number } | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    const id = elementId;
    // In dev (React Strict Mode), effects can run twice; ensure we don't mount twice.
    if (initRef.current) return;
    initRef.current = true;

    // Ensure container is clean (prevents duplicated video elements).
    const el = typeof document !== "undefined" ? document.getElementById(id) : null;
    if (el) el.replaceChildren();

    const qr = new Html5Qrcode(id);
    qrRef.current = qr;

    const pruneDuplicateVideo = () => {
      const node = typeof document !== "undefined" ? document.getElementById(id) : null;
      if (!node) return;
      const videos = Array.from(node.querySelectorAll("video"));
      if (videos.length <= 1) return;
      // Keep the first video (the one html5-qrcode uses), remove extra duplicates.
      for (const v of videos.slice(1)) v.remove();
    };

    let pruneTimer: ReturnType<typeof setTimeout> | null = null;

    void qr
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          const text = String(decodedText ?? "").trim();
          if (!text) return;
          const now = Date.now();
          const last = lastRef.current;
          // html5-qrcode can fire multiple times for the same QR; dedupe for 2 seconds.
          if (last && last.text === text && now - last.at < 2000) return;
          lastRef.current = { text, at: now };
          onDecoded(text);
        },
        () => {},
      )
      .then(() => {
        startedRef.current = true;
        // Some browsers / dev mode cause duplicated <video> nodes; prune them.
        pruneDuplicateVideo();
        pruneTimer = setTimeout(pruneDuplicateVideo, 250);
      })
      .catch(() => {
        startedRef.current = false;
      });

    return () => {
      initRef.current = false;
      if (pruneTimer) clearTimeout(pruneTimer);
      const current = qrRef.current;
      qrRef.current = null;
      if (!current) return;

      const stopSafely = async () => {
        try {
          if (startedRef.current) await current.stop();
        } catch {
          // ignore
        } finally {
          startedRef.current = false;
        }

        try {
          await current.clear();
        } catch {
          // ignore
        }

        // Final DOM cleanup (helps when clear() fails silently).
        const node = typeof document !== "undefined" ? document.getElementById(id) : null;
        if (node) node.replaceChildren();
      };

      void stopSafely();
    };
  }, [elementId, onDecoded]);

  return <div id={elementId} />;
}

