import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, requireAdmin } from "@/lib/server/api-auth";
import { updateEmployeProfile } from "@/lib/server/access-management";

const bodySchema = z.object({
  nom: z.string().min(2).optional(),
  email: z.string().email().optional(),
  matricule: z.string().optional(),
  departement: z.string().optional(),
  poste: z.string().optional(),
  telephone: z.string().optional(),
  cin: z.string().optional(),
  adresse: z.string().optional(),
  dateNaissance: z.string().optional(),
  dateEmbauche: z.string().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { uid } = await requireAdmin(request);
    const { id } = await context.params;
    const body = bodySchema.parse(await request.json());
    const employe = await updateEmployeProfile({ userId: id, adminUid: uid, patch: body });
    return NextResponse.json({ employe });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
