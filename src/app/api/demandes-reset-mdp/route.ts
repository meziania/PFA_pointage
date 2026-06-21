import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, apiErrorResponse } from "@/lib/server/api-errors";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const createSchema = z.object({
  email: z.string().email(),
  message: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const { assertAdminConfigured } = await import("@/lib/server/firebase-admin");
    const { createPasswordResetRequest } = await import("@/lib/server/password-reset-requests");

    assertAdminConfigured();
    const ip = getClientIp(request);
    if (!checkRateLimit(`reset-mdp:${ip}`, 5, 60 * 60 * 1000)) {
      throw ApiError.badRequest("Trop de demandes. Réessayez plus tard.");
    }

    const body = createSchema.parse(await request.json());
    const result = await createPasswordResetRequest(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    const { requireAdmin } = await import("@/lib/server/api-auth");
    await requireAdmin(request);

    const { listPasswordResetRequests } = await import("@/lib/server/password-reset-requests");
    const url = new URL(request.url);
    const statut = url.searchParams.get("statut");
    const rows = await listPasswordResetRequests(
      statut === "en_attente" || statut === "traitee" || statut === "refusee" ? { statut } : undefined,
    );
    return NextResponse.json({ demandes: rows });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
