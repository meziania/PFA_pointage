import crypto from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/server/firebase-admin";
import {
  generateDynamicQrToken,
  getQrWindowInfo,
  QR_WINDOW_MS,
  validateDynamicQrToken,
} from "@/lib/server/qr-dynamic";
import { getAppUrl } from "@/lib/server/api-auth";

type PointageSettingsDoc = {
  qrMode?: unknown;
  qrSecret?: unknown;
  qrToken?: unknown;
  qrTokenHash?: unknown;
  qrExpiresAt?: { toMillis?: () => number } | null;
  previousQrTokenHash?: unknown;
  allowPreviousHashUntil?: { toMillis?: () => number } | null;
};

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

function readEnvSecret(): string | null {
  const secret = process.env.POINTAGE_QR_SECRET?.trim();
  return secret || null;
}

async function readSettingsDoc(): Promise<PointageSettingsDoc | null> {
  const snap = await getAdminDb().collection("settings").doc("pointage").get();
  return snap.exists ? (snap.data() as PointageSettingsDoc) : null;
}

export async function resolveDynamicSecret(): Promise<string | null> {
  const data = await readSettingsDoc();
  if (data?.qrMode === "dynamic") {
    const stored = typeof data.qrSecret === "string" ? data.qrSecret.trim() : "";
    if (stored) return stored;
  }
  return readEnvSecret();
}

export async function ensureDynamicQrMode(): Promise<string> {
  const existing = await resolveDynamicSecret();
  if (existing) {
    await getAdminDb()
      .collection("settings")
      .doc("pointage")
      .set({ qrMode: "dynamic", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return existing;
  }

  const secret = crypto.randomBytes(32).toString("base64url");
  await getAdminDb()
    .collection("settings")
    .doc("pointage")
    .set(
      {
        qrMode: "dynamic",
        qrSecret: secret,
        updatedAt: FieldValue.serverTimestamp(),
        qrToken: FieldValue.delete(),
        qrTokenHash: FieldValue.delete(),
        qrExpiresAt: FieldValue.delete(),
        previousQrTokenHash: FieldValue.delete(),
        allowPreviousHashUntil: FieldValue.delete(),
      },
      { merge: true },
    );
  return secret;
}

export async function getCurrentDynamicQrPayload(nowMs = Date.now()) {
  const secret = await ensureDynamicQrMode();
  const window = getQrWindowInfo(nowMs);
  const token = generateDynamicQrToken(secret, window.counter);
  const qrLink = `${getAppUrl()}/pointage?token=${encodeURIComponent(token)}`;
  return {
    mode: "dynamic" as const,
    token,
    qrLink,
    windowMs: QR_WINDOW_MS,
    windowEndsAtMs: window.endsAtMs,
    secondsRemaining: window.secondsRemaining,
  };
}

export async function validatePointageQr(rawQr: string): Promise<void> {
  const provided = extractQrToken(rawQr);
  if (!provided) throw new Error("QR invalide");

  const secret = await resolveDynamicSecret();
  if (secret) {
    if (!validateDynamicQrToken(provided, secret)) {
      throw new Error("QR invalide ou expiré");
    }
    return;
  }

  const data = await readSettingsDoc();
  const expiresAtMs = typeof data?.qrExpiresAt?.toMillis === "function" ? data.qrExpiresAt.toMillis() : null;
  const tokenHash = typeof data?.qrTokenHash === "string" ? data.qrTokenHash.trim() : "";
  const tokenClear = typeof data?.qrToken === "string" ? data.qrToken.trim() : "";
  const expected = tokenHash || tokenClear || process.env.POINTAGE_QR_TOKEN?.trim() || "";

  if (!expected) throw new Error("QR de pointage non configuré");

  const providedHash = sha256Hex(provided);
  const expectedLooksHashed = expected.length === 64 && /^[0-9a-f]{64}$/i.test(expected);

  if (expectedLooksHashed) {
    if (providedHash !== expected) {
      const prevHash = typeof data?.previousQrTokenHash === "string" ? data.previousQrTokenHash.trim() : "";
      const prevUntil =
        typeof data?.allowPreviousHashUntil?.toMillis === "function" ? data.allowPreviousHashUntil.toMillis() : null;
      const prevOk = Boolean(prevHash && prevUntil && Date.now() <= prevUntil && providedHash === prevHash);
      if (!prevOk) throw new Error("QR invalide");
    }
  } else if (provided !== expected) {
    throw new Error("QR invalide");
  }

  if (typeof expiresAtMs === "number" && Number.isFinite(expiresAtMs) && Date.now() > expiresAtMs) {
    throw new Error("QR expiré");
  }
}
