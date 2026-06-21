import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api-errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { requireAdmin } = await import("@/lib/server/api-auth");
    const { supprimerDemandeAcces } = await import("@/lib/server/access-management");

    const { uid } = await requireAdmin(request);
    const { id } = await context.params;
    await supprimerDemandeAcces({ demandeId: id, adminUid: uid });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
