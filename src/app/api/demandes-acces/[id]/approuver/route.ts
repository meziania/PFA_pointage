import { NextResponse } from "next/server";
import { apiErrorResponse, requireAdmin } from "@/lib/server/api-auth";
import { approuverDemandeAcces } from "@/lib/server/access-management";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { uid } = await requireAdmin(request);
    const { id } = await context.params;
    const result = await approuverDemandeAcces({ demandeId: id, adminUid: uid });
    return NextResponse.json({
      statut: "approuvee",
      uid: result.uid,
      email: result.email,
      temporaryPassword: result.temporaryPassword,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
