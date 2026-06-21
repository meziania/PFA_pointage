import { NextResponse } from "next/server";
import { apiErrorResponse, requireEmploye } from "@/lib/server/api-auth";
import { createProfileRequiredNotification } from "@/lib/server/notifications";
import { isProfileComplete } from "@/lib/profile-completeness";

export async function POST(request: Request) {
  try {
    const { uid, user } = await requireEmploye(request);
    if (isProfileComplete(user)) {
      return NextResponse.json({ ok: true, skipped: true });
    }
    await createProfileRequiredNotification({ userId: uid, nom: user.nom });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
