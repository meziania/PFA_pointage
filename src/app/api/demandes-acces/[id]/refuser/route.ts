import { NextResponse } from "next/server";
import { apiErrorResponse, requireAdmin } from "@/lib/server/api-auth";
import { refuserDemandeAcces } from "@/lib/server/access-management";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { uid } = await requireAdmin(request);
    const { id } = await context.params;
    await refuserDemandeAcces({ demandeId: id, adminUid: uid });
    return NextResponse.json({ statut: "refusee" });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
