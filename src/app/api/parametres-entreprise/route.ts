import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, requireAdmin } from "@/lib/server/api-auth";
import { getParametresEntreprise, upsertParametresEntreprise } from "@/lib/server/parametres-entreprise";

const updateSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  rayon_metres: z.number().positive(),
});

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const params = await getParametresEntreprise();
    return NextResponse.json({ parametres: params });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const { uid } = await requireAdmin(request);
    const body = updateSchema.parse(await request.json());
    const saved = await upsertParametresEntreprise({ ...body, adminUid: uid });
    return NextResponse.json({ parametres: saved });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
