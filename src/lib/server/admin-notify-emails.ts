import { isValidEmail, normalizeEmail } from "@/lib/server/api-errors";
import { getAdminDb } from "@/lib/server/firebase-admin";
import type { UserDoc } from "@/lib/data-model";

/** Destinataires admin : ADMIN_NOTIFY_EMAIL (Outlook, etc.) + comptes admin Firestore. */
export async function resolveAdminNotifyEmails(): Promise<string[]> {
  const emails = new Set<string>();

  for (const raw of (process.env.ADMIN_NOTIFY_EMAIL ?? "").split(",")) {
    const e = normalizeEmail(raw.trim());
    if (e && isValidEmail(e)) emails.add(e);
  }

  const snap = await getAdminDb().collection("users").where("role", "==", "admin").limit(20).get();
  for (const doc of snap.docs) {
    const mail = (doc.data() as UserDoc).email;
    if (typeof mail === "string" && isValidEmail(mail)) {
      emails.add(normalizeEmail(mail));
    }
  }

  return [...emails];
}
