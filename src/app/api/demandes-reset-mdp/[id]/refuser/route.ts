import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api-errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { requireAdmin } = await import("@/lib/server/api-auth");
    const { refuserPasswordResetRequest } = await import("@/lib/server/password-reset-requests");

    const { uid } = await requireAdmin(request);
    const { id } = await context.params;
    const result = await refuserPasswordResetRequest({ demandeId: id, adminUid: uid });
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
