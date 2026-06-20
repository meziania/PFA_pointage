import { NextResponse } from "next/server";
import { apiErrorResponse, requireAdmin } from "@/lib/server/api-auth";
import { desactiverEmploye } from "@/lib/server/access-management";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { uid } = await requireAdmin(request);
    const { id } = await context.params;
    await desactiverEmploye({ userId: id, adminUid: uid });
    return NextResponse.json({ statut: "desactive" });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
