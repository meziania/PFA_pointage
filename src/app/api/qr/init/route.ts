import { NextResponse } from "next/server";
import { apiErrorResponse, requireAdmin } from "@/lib/server/api-auth";
import { ensureDynamicQrMode } from "@/lib/server/qr-settings";

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const secret = await ensureDynamicQrMode();
    return NextResponse.json({ mode: "dynamic", initialized: true, secretLength: secret.length });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
