import crypto from "node:crypto";

export const QR_WINDOW_MS = 30_000;

export function getQrWindowCounter(nowMs = Date.now()): number {
  return Math.floor(nowMs / QR_WINDOW_MS);
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

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function extractQrToken(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const u = new URL(raw);
      const token = u.searchParams.get("token") ?? u.searchParams.get("qr") ?? u.searchParams.get("t");
      if (token) return token.trim();
    } catch {
      // ignore
    }
  }
  return raw;
}

type PointageSettings = {
  qrMode?: unknown;
  qrSecret?: unknown;
  qrToken?: unknown;
  qrTokenHash?: unknown;
  qrExpiresAt?: { toMillis?: () => number } | null;
  previousQrTokenHash?: unknown;
  allowPreviousHashUntil?: { toMillis?: () => number } | null;
};

export async function validatePointageQrFromFirestore(
  db: FirebaseFirestore.Firestore,
  rawQr: string,
  envQrToken: string,
  envQrSecret: string,
): Promise<void> {
  const provided = extractQrToken(rawQr);
  if (!provided) throw new Error("Invalid QR token");

  const snap = await db.collection("settings").doc("pointage").get();
  const data = snap.exists ? (snap.data() as PointageSettings) : null;

  const storedSecret = typeof data?.qrSecret === "string" ? data.qrSecret.trim() : "";
  const secret = storedSecret || envQrSecret.trim();

  if (data?.qrMode === "dynamic" && secret) {
    if (!validateDynamicQrToken(provided, secret)) {
      throw new Error("Invalid or expired QR token");
    }
    return;
  }

  if (secret) {
    if (!validateDynamicQrToken(provided, secret)) {
      throw new Error("Invalid or expired QR token");
    }
    return;
  }

  const expiresAtMs = typeof data?.qrExpiresAt?.toMillis === "function" ? data.qrExpiresAt.toMillis() : null;
  const tokenHash = typeof data?.qrTokenHash === "string" ? data.qrTokenHash.trim() : "";
  const tokenClear = typeof data?.qrToken === "string" ? data.qrToken.trim() : "";
  const expected = tokenHash || tokenClear || envQrToken.trim();

  if (!expected) throw new Error("QR token not configured");

  const providedHash = sha256Hex(provided);
  const expectedLooksHashed = expected.length === 64 && /^[0-9a-f]{64}$/i.test(expected);

  if (expectedLooksHashed) {
    if (providedHash !== expected) {
      const prevHash = typeof data?.previousQrTokenHash === "string" ? data.previousQrTokenHash.trim() : "";
      const prevUntil =
        typeof data?.allowPreviousHashUntil?.toMillis === "function" ? data.allowPreviousHashUntil.toMillis() : null;
      const prevOk = Boolean(prevHash && prevUntil && Date.now() <= prevUntil && providedHash === prevHash);
      if (!prevOk) throw new Error("Invalid QR token");
    }
  } else if (provided !== expected) {
    throw new Error("Invalid QR token");
  }

  if (typeof expiresAtMs === "number" && Number.isFinite(expiresAtMs) && Date.now() > expiresAtMs) {
    throw new Error("QR token expired");
  }
}
