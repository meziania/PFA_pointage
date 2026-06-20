import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, requireAdmin } from "@/lib/server/api-auth";
import { createEmployeAccount } from "@/lib/server/access-management";

const bodySchema = z.object({
  nom: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  matricule: z.string().optional(),
  departement: z.string().optional(),
  poste: z.string().optional(),
  telephone: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = bodySchema.parse(await request.json());
    const result = await createEmployeAccount({
      ...body,
      statut: "actif",
      doit_changer_mdp: true,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
