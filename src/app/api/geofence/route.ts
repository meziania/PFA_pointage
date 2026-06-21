import { NextResponse } from "next/server";
import { apiErrorResponse, requireAuth } from "@/lib/server/api-auth";
import { getGeofenceSettings } from "@/lib/server/parametres-entreprise";

export async function GET(request: Request) {
  try {
    await requireAuth(request);
    const geofence = await getGeofenceSettings();
    if (!geofence) {
      return NextResponse.json({ geofence: null });
    }
    return NextResponse.json({
      geofence: {
        latitude: geofence.latitude,
        longitude: geofence.longitude,
        rayon_metres: geofence.radiusM,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
