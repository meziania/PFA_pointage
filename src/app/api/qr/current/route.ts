import { NextResponse } from "next/server";
import { apiErrorResponse, requireAdmin } from "@/lib/server/api-auth";
import { getCurrentDynamicQrPayload } from "@/lib/server/qr-settings";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const payload = await getCurrentDynamicQrPayload();
    return NextResponse.json(payload);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
