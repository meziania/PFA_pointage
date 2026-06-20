import { NextResponse } from "next/server";
import { getServerEnvStatus } from "@/lib/server/env";

export async function GET() {
  const env = getServerEnvStatus();
  return NextResponse.json({
    ok: env.firebaseClient && (env.firebaseAdmin || process.env.NODE_ENV === "development"),
    env: {
      firebaseClient: env.firebaseClient,
      firebaseAdmin: env.firebaseAdmin,
      qrSecret: env.qrSecret,
      geofenceFallback: env.geofenceFallback,
      smtp: env.smtp,
      appUrl: env.appUrl,
    },
    warnings: env.warnings,
  });
}
