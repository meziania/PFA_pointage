import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, requireAuth } from "@/lib/server/api-auth";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const bodySchema = z.object({
  newPassword: z.string().min(6),
});

export async function PUT(request: Request) {
  try {
    const { uid } = await requireAuth(request);
    const { newPassword } = bodySchema.parse(await request.json());

    const { getAdminAuth } = await import("@/lib/server/firebase-admin");
    await getAdminAuth().updateUser(uid, { password: newPassword });

    await getAdminDb().collection("users").doc(uid).update({
      doit_changer_mdp: false,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
