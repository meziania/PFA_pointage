import crypto from "node:crypto";

export const QR_WINDOW_MS = 30_000;

export function getQrWindowCounter(nowMs = Date.now()): number {
  return Math.floor(nowMs / QR_WINDOW_MS);
}

export function getQrWindowInfo(nowMs = Date.now()): { counter: number; endsAtMs: number; secondsRemaining: number } {
  const counter = getQrWindowCounter(nowMs);
  const endsAtMs = (counter + 1) * QR_WINDOW_MS;
  return {
    counter,
    endsAtMs,
    secondsRemaining: Math.max(0, Math.ceil((endsAtMs - nowMs) / 1000)),
  };
}

export function generateDynamicQrToken(secret: string, counter?: number): string {
  const c = counter ?? getQrWindowCounter();
  return crypto.createHmac("sha256", secret).update(String(c)).digest("base64url").slice(0, 24);
}

export function validateDynamicQrToken(provided: string, secret: string, nowMs = Date.now()): boolean {
  const counter = getQrWindowCounter(nowMs);
  const current = generateDynamicQrToken(secret, counter);
  const previous = generateDynamicQrToken(secret, counter - 1);
  return provided === current || provided === previous;
}
