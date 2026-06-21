import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/server/firebase-admin";

export async function createProfileRequiredNotification(params: { userId: string; nom: string }): Promise<void> {
  const snap = await getAdminDb()
    .collection("notifications")
    .where("userId", "==", params.userId)
    .where("type", "==", "profile_required")
    .limit(1)
    .get();

  if (!snap.empty) return;

  await getAdminDb().collection("notifications").add({
    userId: params.userId,
    type: "profile_required",
    title: "Profil à compléter — obligatoire",
    body: `Bonjour ${params.nom}, bienvenue sur TimeTrack Pro. Avant d'utiliser l'application (pointage, congés), vous devez compléter votre profil employé. Rendez-vous dans « Mon profil ».`,
    actionHref: "/profil",
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
}
