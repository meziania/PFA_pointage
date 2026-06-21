import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api-errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { requireAdmin } = await import("@/lib/server/api-auth");
    const { supprimerPasswordResetRequest } = await import("@/lib/server/password-reset-requests");

    await requireAdmin(_request);
    const { id } = await context.params;
    const result = await supprimerPasswordResetRequest(id);
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
