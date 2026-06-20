import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, apiErrorResponse, requireAdmin } from "@/lib/server/api-auth";
import { createDemandeAcces, listDemandesAcces } from "@/lib/server/access-management";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit";

const createSchema = z.object({
  nom: z.string().min(2),
  email: z.string().email(),
  telephone: z.string().optional(),
  message: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (!checkRateLimit(`demandes-acces:${ip}`, 5, 60 * 60 * 1000)) {
      throw ApiError.badRequest("Trop de demandes. Réessayez plus tard.");
    }
    const body = createSchema.parse(await request.json());
    const result = await createDemandeAcces(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const url = new URL(request.url);
    const statut = url.searchParams.get("statut");
    const rows = await listDemandesAcces(
      statut === "en_attente" || statut === "approuvee" || statut === "refusee" ? { statut } : undefined,
    );
    return NextResponse.json({ demandes: rows });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
