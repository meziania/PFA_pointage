import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Inscription directe désactivée. Utilisez /register pour demander l'accès à l'administrateur.",
    },
    { status: 410 },
  );
}
