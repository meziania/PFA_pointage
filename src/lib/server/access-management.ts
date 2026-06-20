import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/server/firebase-admin";
import {
  ApiError,
  getUserDocAdmin,
  isValidEmail,
  normalizeEmail,
} from "@/lib/server/api-auth";
import { generateTempPassword } from "@/lib/server/password";
import { sendAccessApprovedEmail, sendAccessRefusedEmail, sendJoinRequestAdminNotification } from "@/lib/server/email";
import type { DemandeAccesDoc, UserDoc } from "@/lib/data-model";

const COLLECTION = "demandes_acces";

async function resolveAdminNotifyEmails(): Promise<string[]> {
  const fromEnv = (process.env.ADMIN_NOTIFY_EMAIL ?? "")
    .split(",")
    .map((e) => normalizeEmail(e.trim()))
    .filter((e) => e && isValidEmail(e));

  if (fromEnv.length) return [...new Set(fromEnv)];

  const snap = await getAdminDb().collection("users").where("role", "==", "admin").limit(20).get();
  const emails = snap.docs
    .map((d) => (d.data() as UserDoc).email)
    .filter((e): e is string => typeof e === "string" && isValidEmail(e))
    .map(normalizeEmail);

  return [...new Set(emails)];
}

async function emailAlreadyRegistered(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);

  const usersSnap = await getAdminDb().collection("users").where("email", "==", normalized).limit(1).get();
  if (!usersSnap.empty) return true;

  try {
    await getAdminAuth().getUserByEmail(normalized);
    return true;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "auth/user-not-found") return false;
    throw err;
  }
}

export async function createEmployeAccount(params: {
  nom: string;
  email: string;
  password: string;
  telephone?: string;
  departement?: string;
  poste?: string;
  matricule?: string;
  statut?: UserDoc["statut"];
  doit_changer_mdp?: boolean;
}): Promise<{ uid: string; email: string }> {
  const nom = params.nom.trim();
  const email = normalizeEmail(params.email);
  const password = params.password;

  if (nom.length < 2) throw ApiError.badRequest("Le nom doit contenir au moins 2 caractères");
  if (!isValidEmail(email)) throw ApiError.badRequest("Email invalide");
  if (password.length < 6) throw ApiError.badRequest("Le mot de passe doit contenir au moins 6 caractères");
  if (await emailAlreadyRegistered(email)) throw ApiError.conflict("Cet email est déjà utilisé");

  const userRecord = await getAdminAuth().createUser({
    email,
    password,
    displayName: nom,
    disabled: false,
  });

  const userDoc: Record<string, unknown> = {
    nom,
    email,
    role: "employe",
    statut: params.statut ?? "actif",
    doit_changer_mdp: params.doit_changer_mdp ?? true,
    createdAt: FieldValue.serverTimestamp(),
  };

  for (const [key, value] of Object.entries({
    telephone: params.telephone,
    departement: params.departement,
    poste: params.poste,
    matricule: params.matricule,
  })) {
    if (typeof value === "string" && value.trim()) userDoc[key] = value.trim();
  }

  await getAdminDb().collection("users").doc(userRecord.uid).set(userDoc);
  return { uid: userRecord.uid, email };
}

export async function createDemandeAcces(input: {
  nom: string;
  email: string;
  telephone?: string;
  message?: string;
}): Promise<{ id: string }> {
  const nom = input.nom.trim();
  const email = normalizeEmail(input.email);
  const telephone = input.telephone?.trim() ?? "";
  const message = input.message?.trim() ?? "";

  if (nom.length < 2) throw ApiError.badRequest("Le nom doit contenir au moins 2 caractères");
  if (!isValidEmail(email)) throw ApiError.badRequest("Email invalide");

  if (await emailAlreadyRegistered(email)) {
    throw ApiError.conflict("Un compte existe déjà avec cet email. Connectez-vous.");
  }

  const pendingSnap = await getAdminDb()
    .collection(COLLECTION)
    .where("email", "==", email)
    .where("statut", "==", "en_attente")
    .limit(1)
    .get();

  if (!pendingSnap.empty) {
    throw ApiError.conflict("Une demande est déjà en attente pour cet email");
  }

  const docData: Record<string, unknown> = {
    nom,
    email,
    statut: "en_attente",
    date_demande: FieldValue.serverTimestamp(),
  };
  if (telephone) docData.telephone = telephone;
  if (message) docData.message = message;

  const ref = await getAdminDb().collection(COLLECTION).add(docData);

  try {
    const adminEmails = await resolveAdminNotifyEmails();
    await sendJoinRequestAdminNotification({
      adminEmails,
      demandeId: ref.id,
      nom,
      email,
      telephone: telephone || undefined,
      message: message || undefined,
    });
  } catch (err) {
    console.error("[email] Notification admin demande d'accès:", err);
  }

  return { id: ref.id };
}

export async function listDemandesAcces(options?: { statut?: DemandeAccesDoc["statut"] }) {
  let query = getAdminDb().collection(COLLECTION).orderBy("date_demande", "desc").limit(200);
  if (options?.statut) {
    query = getAdminDb()
      .collection(COLLECTION)
      .where("statut", "==", options.statut)
      .orderBy("date_demande", "desc")
      .limit(200);
  }

  const snap = await query.get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as DemandeAccesDoc) }));
}

export async function approuverDemandeAcces(params: {
  demandeId: string;
  adminUid: string;
}): Promise<{ uid: string; email: string; temporaryPassword: string }> {
  const ref = getAdminDb().collection(COLLECTION).doc(params.demandeId);
  const snap = await ref.get();
  if (!snap.exists) throw ApiError.notFound("Demande introuvable");

  const demande = snap.data() as DemandeAccesDoc;
  if (demande.statut !== "en_attente") {
    throw ApiError.conflict("Cette demande a déjà été traitée");
  }

  const temporaryPassword = generateTempPassword();
  const created = await createEmployeAccount({
    nom: demande.nom,
    email: demande.email,
    password: temporaryPassword,
    telephone: demande.telephone,
    statut: "actif",
    doit_changer_mdp: true,
  });

  await ref.update({
    statut: "approuvee",
    date_traitement: FieldValue.serverTimestamp(),
    traite_par: params.adminUid,
    userId: created.uid,
  });

  await sendAccessApprovedEmail({
    to: demande.email,
    nom: demande.nom,
    email: created.email,
    temporaryPassword,
  });

  return { ...created, temporaryPassword };
}

export async function refuserDemandeAcces(params: { demandeId: string; adminUid: string }): Promise<void> {
  const ref = getAdminDb().collection(COLLECTION).doc(params.demandeId);
  const snap = await ref.get();
  if (!snap.exists) throw ApiError.notFound("Demande introuvable");

  const demande = snap.data() as DemandeAccesDoc;
  if (demande.statut !== "en_attente") {
    throw ApiError.conflict("Cette demande a déjà été traitée");
  }

  await ref.update({
    statut: "refusee",
    date_traitement: FieldValue.serverTimestamp(),
    traite_par: params.adminUid,
  });

  await sendAccessRefusedEmail({ to: demande.email, nom: demande.nom });
}

export async function desactiverEmploye(params: { userId: string; adminUid: string }): Promise<void> {
  const user = await getUserDocAdmin(params.userId);
  if (!user) throw ApiError.notFound("Employé introuvable");
  if (user.role !== "employe") throw ApiError.badRequest("Seuls les employés peuvent être désactivés");
  if (user.statut === "desactive") throw ApiError.conflict("Employé déjà désactivé");

  await getAdminDb().collection("users").doc(params.userId).update({
    statut: "desactive",
    updatedAt: FieldValue.serverTimestamp(),
  });

  try {
    await getAdminAuth().updateUser(params.userId, { disabled: true });
  } catch {
    // Auth user may not exist for legacy records
  }
}

export async function reactiverEmploye(params: { userId: string; adminUid: string }): Promise<void> {
  const user = await getUserDocAdmin(params.userId);
  if (!user) throw ApiError.notFound("Employé introuvable");
  if (user.role !== "employe") throw ApiError.badRequest("Seuls les employés peuvent être réactivés");
  if ((user.statut ?? "actif") === "actif") throw ApiError.conflict("Employé déjà actif");

  await getAdminDb().collection("users").doc(params.userId).update({
    statut: "actif",
    updatedAt: FieldValue.serverTimestamp(),
  });

  try {
    await getAdminAuth().updateUser(params.userId, { disabled: false });
  } catch {
    // ignore if auth record missing
  }
}

export type UpdateEmployeInput = {
  nom?: string;
  email?: string;
  matricule?: string;
  departement?: string;
  poste?: string;
  telephone?: string;
  cin?: string;
  adresse?: string;
  dateNaissance?: string;
  dateEmbauche?: string;
};

export async function updateEmployeProfile(params: {
  userId: string;
  adminUid: string;
  patch: UpdateEmployeInput;
}): Promise<UserDoc & { id: string }> {
  const user = await getUserDocAdmin(params.userId);
  if (!user) throw ApiError.notFound("Employé introuvable");
  if (user.role !== "employe") throw ApiError.badRequest("Seuls les profils employés sont modifiables");

  const data: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

  if (typeof params.patch.nom === "string") {
    const nom = params.patch.nom.trim();
    if (nom.length < 2) throw ApiError.badRequest("Le nom doit contenir au moins 2 caractères");
    data.nom = nom;
  }

  if (typeof params.patch.email === "string") {
    const email = normalizeEmail(params.patch.email);
    if (!isValidEmail(email)) throw ApiError.badRequest("Email invalide");
    if (email !== normalizeEmail(user.email)) {
      try {
        await getAdminAuth().getUserByEmail(email);
        throw ApiError.conflict("Cet email est déjà utilisé");
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code !== "auth/user-not-found") {
          if (err instanceof ApiError) throw err;
          throw err;
        }
      }
      data.email = email;
      try {
        await getAdminAuth().updateUser(params.userId, { email, displayName: (data.nom as string) ?? user.nom });
      } catch {
        throw ApiError.badRequest("Impossible de mettre à jour l'email Firebase Auth");
      }
    }
  }

  const optionalStrings: Array<keyof UpdateEmployeInput> = [
    "matricule",
    "departement",
    "poste",
    "telephone",
    "cin",
    "adresse",
    "dateNaissance",
    "dateEmbauche",
  ];

  for (const key of optionalStrings) {
    const v = params.patch[key];
    if (typeof v !== "string") continue;
    const trimmed = v.trim();
    if (trimmed) data[key] = trimmed;
    else data[key] = FieldValue.delete();
  }

  if (Object.keys(data).length <= 1) throw ApiError.badRequest("Aucune modification fournie");

  await getAdminDb().collection("users").doc(params.userId).update(data);
  const updated = await getUserDocAdmin(params.userId);
  if (!updated) throw ApiError.server("Profil introuvable après mise à jour");
  return updated;
}

export async function assertUserCanLogin(uid: string): Promise<UserDoc & { id: string }> {
  const user = await getUserDocAdmin(uid);
  if (!user) throw ApiError.forbidden("Compte non activé. Contactez l'administrateur.");
  if ((user.statut ?? "actif") !== "actif") {
    throw ApiError.forbidden("Compte désactivé. Contactez l'administrateur.");
  }
  return user;
}
