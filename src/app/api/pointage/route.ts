import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, requireEmploye } from "@/lib/server/api-auth";
import { createPointageRecord } from "@/lib/server/pointage";

const bodySchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  qr: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const { uid } = await requireEmploye(request);
    const body = bodySchema.parse(await request.json());
    const result = await createPointageRecord({ uid, ...body });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
