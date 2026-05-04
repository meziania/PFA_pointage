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
  const doneRef = useRef(false);

  useEffect(() => {
    const id = elementId;
    // In dev (React Strict Mode), effects can run twice; ensure we don't mount twice.
    if (initRef.current) return;
    initRef.current = true;

    const qr = new Html5Qrcode(id);
    qrRef.current = qr;

    const hideDuplicateVideo = () => {
      const node = typeof document !== "undefined" ? document.getElementById(id) : null;
      if (!node) return;
      const videos = Array.from(node.querySelectorAll("video"));
      if (videos.length <= 1) return;
      // Don't remove nodes (can interrupt play()); just hide duplicates.
      for (const v of videos.slice(1)) {
        v.style.display = "none";
        v.style.visibility = "hidden";
        v.style.height = "0px";
        v.style.width = "0px";
      }
    };

    let pruneTimer: ReturnType<typeof setTimeout> | null = null;

    void qr
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (doneRef.current) return;
          const text = String(decodedText ?? "").trim();
          if (!text) return;
          const now = Date.now();
          const last = lastRef.current;
          // html5-qrcode can fire multiple times for the same QR; dedupe for 2 seconds.
          if (last && last.text === text && now - last.at < 2000) return;
          lastRef.current = { text, at: now };
          doneRef.current = true;
          onDecoded(text);
        },
        () => {},
      )
      .then(() => {
        startedRef.current = true;
        // Some browsers / dev mode cause duplicated <video> nodes; prune them.
        hideDuplicateVideo();
        pruneTimer = setTimeout(hideDuplicateVideo, 250);
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
      };

      void stopSafely();
    };
  }, [elementId, onDecoded]);

  return <div id={elementId} />;
}

