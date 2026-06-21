"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

function getQrBoxSize(): number {
  if (typeof window === "undefined") return 240;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const base = Math.min(w, h) - 48;
  return Math.max(180, Math.min(280, Math.floor(base * 0.72)));
}

export function QrScanner({ onDecoded }: { onDecoded: (text: string) => void }) {
  const [elementId] = useState(() => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `qr_${crypto.randomUUID()}`;
    return `qr_${Date.now().toString(16)}`;
  });
  const [qrBox, setQrBox] = useState(getQrBoxSize);
  const qrRef = useRef<Html5Qrcode | null>(null);
  const startedRef = useRef(false);
  const lastRef = useRef<{ text: string; at: number } | null>(null);
  const initRef = useRef(false);
  const doneRef = useRef(false);

  useEffect(() => {
    const onResize = () => setQrBox(getQrBoxSize());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const id = elementId;
    if (initRef.current) return;
    initRef.current = true;

    const qr = new Html5Qrcode(id);
    qrRef.current = qr;

    const hideDuplicateVideo = () => {
      const node = typeof document !== "undefined" ? document.getElementById(id) : null;
      if (!node) return;
      const videos = Array.from(node.querySelectorAll("video"));
      if (videos.length <= 1) return;
      for (const v of videos.slice(1)) {
        v.style.display = "none";
        v.style.visibility = "hidden";
        v.style.height = "0px";
        v.style.width = "0px";
      }
    };

    let pruneTimer: ReturnType<typeof setTimeout> | null = null;
    const box = getQrBoxSize();

    void qr
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: box, height: box }, aspectRatio: 1 },
        (decodedText) => {
          if (doneRef.current) return;
          const text = String(decodedText ?? "").trim();
          if (!text) return;
          const now = Date.now();
          const last = lastRef.current;
          if (last && last.text === text && now - last.at < 2000) return;
          lastRef.current = { text, at: now };
          doneRef.current = true;
          onDecoded(text);
        },
        () => {},
      )
      .then(() => {
        startedRef.current = true;
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

  return (
    <div className="mx-auto w-full max-w-sm overflow-hidden rounded-xl">
      <div id={elementId} style={{ minHeight: qrBox }} />
    </div>
  );
}
