import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/server/api-errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { requireAdmin } = await import("@/lib/server/api-auth");
    const { approuverDemandeAcces } = await import("@/lib/server/access-management");

    const { uid } = await requireAdmin(request);
    const { id } = await context.params;
    const result = await approuverDemandeAcces({ demandeId: id, adminUid: uid });
    return NextResponse.json({
      statut: "approuvee",
      uid: result.uid,
      email: result.email,
      temporaryPassword: result.temporaryPassword,
      emailSent: result.emailSent,
      loginUrl: result.loginUrl,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
