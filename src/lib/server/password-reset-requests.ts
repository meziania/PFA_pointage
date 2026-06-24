import { FieldValue } from "firebase-admin/firestore";
import {
  ApiError,
  getAppUrl,
  isValidEmail,
  normalizeEmail,
} from "@/lib/server/api-errors";
import { getUserDocAdmin } from "@/lib/server/api-auth";
import { getAdminAuth, getAdminDb } from "@/lib/server/firebase-admin";
import { generateTempPassword } from "@/lib/server/password";
import {
  sendPasswordResetApprovedEmail,
  sendPasswordResetRequestAdminNotification,
} from "@/lib/server/email";
import { resolveAdminNotifyEmails } from "@/lib/server/admin-notify-emails";
import type { DemandeResetMdpDoc, UserDoc } from "@/lib/data-model";

const COLLECTION = "demandes_reset_mdp";

async function notifyAdminsPasswordReset(params: {
  demandeId: string;
  nom: string;
  email: string;
  message?: string;
  reminder?: boolean;
}) {
  const adminEmails = await resolveAdminNotifyEmails();
  if (!adminEmails.length) {
    console.warn("[email] Aucun destinataire admin — définissez ADMIN_NOTIFY_EMAIL (ex. syspointage@outlook.com) sur Vercel");
    return;
  }
  await sendPasswordResetRequestAdminNotification({
    adminEmails,
    demandeId: params.demandeId,
    nom: params.nom,
    email: params.email,
    message: params.message,
    reminder: params.reminder,
  });
}

async function findActiveEmployeByEmail(email: string): Promise<(UserDoc & { id: string }) | null> {
  const snap = await getAdminDb().collection("users").where("email", "==", email).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  const user = { id: doc.id, ...(doc.data() as UserDoc) };
  if (user.role !== "employe") return null;
  if ((user.statut ?? "actif") !== "actif") return null;
  return user;
}

/** Réponse générique pour ne pas révéler si l'email existe. */
export async function createPasswordResetRequest(input: {
  email: string;
  message?: string;
}): Promise<{ ok: true }> {
  const email = normalizeEmail(input.email);
  const message = input.message?.trim() ?? "";

  if (!isValidEmail(email)) throw ApiError.badRequest("Email invalide");

  const employe = await findActiveEmployeByEmail(email);
  if (!employe) return { ok: true };

  const pendingSnap = await getAdminDb()
    .collection(COLLECTION)
    .where("email", "==", email)
    .where("statut", "==", "en_attente")
    .limit(1)
    .get();

  if (!pendingSnap.empty) {
    const existing = pendingSnap.docs[0];
    const data = existing.data() as DemandeResetMdpDoc;
    try {
      await notifyAdminsPasswordReset({
        demandeId: existing.id,
        nom: data.nom ?? employe.nom,
        email,
        message: message || data.message,
        reminder: true,
      });
    } catch (err) {
      console.error("[email] Rappel admin réinitialisation MDP:", err);
    }
    return { ok: true };
  }

  const docData: Record<string, unknown> = {
    userId: employe.id,
    nom: employe.nom,
    email,
    statut: "en_attente",
    date_demande: FieldValue.serverTimestamp(),
  };
  if (message) docData.message = message;

  const ref = await getAdminDb().collection(COLLECTION).add(docData);

  try {
    await notifyAdminsPasswordReset({
      demandeId: ref.id,
      nom: employe.nom,
      email,
      message: message || undefined,
    });
  } catch (err) {
    console.error("[email] Notification admin réinitialisation MDP:", err);
  }

  return { ok: true };
}

export async function listPasswordResetRequests(options?: { statut?: DemandeResetMdpDoc["statut"] }) {
  let query = getAdminDb().collection(COLLECTION).orderBy("date_demande", "desc").limit(200);
  if (options?.statut) {
    query = getAdminDb()
      .collection(COLLECTION)
      .where("statut", "==", options.statut)
      .orderBy("date_demande", "desc")
      .limit(200);
  }

  const snap = await query.get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as DemandeResetMdpDoc) }));
}

export async function traiterPasswordResetRequest(params: {
  demandeId: string;
  adminUid: string;
}): Promise<{
  email: string;
  nom: string;
  temporaryPassword: string;
  emailSent: boolean;
  loginUrl: string;
}> {
  const ref = getAdminDb().collection(COLLECTION).doc(params.demandeId);
  const snap = await ref.get();
  if (!snap.exists) throw ApiError.notFound("Demande introuvable");

  const demande = snap.data() as DemandeResetMdpDoc;
  if (demande.statut !== "en_attente") {
    throw ApiError.conflict("Cette demande a déjà été traitée");
  }

  const user = await getUserDocAdmin(demande.userId);
  if (!user || user.role !== "employe") {
    throw ApiError.badRequest("Employé introuvable pour cette demande");
  }
  if ((user.statut ?? "actif") !== "actif") {
    throw ApiError.conflict("Le compte employé est désactivé");
  }

  const temporaryPassword = generateTempPassword();
  await getAdminAuth().updateUser(demande.userId, { password: temporaryPassword });
  await getAdminDb()
    .collection("users")
    .doc(demande.userId)
    .update({
      doit_changer_mdp: true,
      updatedAt: FieldValue.serverTimestamp(),
    });

  await ref.update({
    statut: "traitee",
    date_traitement: FieldValue.serverTimestamp(),
    traite_par: params.adminUid,
  });

  let emailSent = false;
  try {
    await sendPasswordResetApprovedEmail({
      to: demande.email,
      nom: demande.nom,
      email: demande.email,
      temporaryPassword,
    });
    emailSent = true;
  } catch (err) {
    console.error("[email] Envoi identifiants réinitialisation MDP:", err);
  }

  return {
    email: demande.email,
    nom: demande.nom,
    temporaryPassword,
    emailSent,
    loginUrl: `${getAppUrl()}/login`,
  };
}

export async function refuserPasswordResetRequest(params: { demandeId: string; adminUid: string }) {
  const ref = getAdminDb().collection(COLLECTION).doc(params.demandeId);
  const snap = await ref.get();
  if (!snap.exists) throw ApiError.notFound("Demande introuvable");

  const demande = snap.data() as DemandeResetMdpDoc;
  if (demande.statut !== "en_attente") {
    throw ApiError.conflict("Cette demande a déjà été traitée");
  }

  await ref.update({
    statut: "refusee",
    date_traitement: FieldValue.serverTimestamp(),
    traite_par: params.adminUid,
  });

  return { statut: "refusee" as const };
}

export async function supprimerPasswordResetRequest(demandeId: string) {
  const ref = getAdminDb().collection(COLLECTION).doc(demandeId);
  const snap = await ref.get();
  if (!snap.exists) throw ApiError.notFound("Demande introuvable");
  await ref.delete();
  return { ok: true as const };
}
