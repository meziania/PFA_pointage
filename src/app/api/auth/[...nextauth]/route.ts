import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "NextAuth désactivé. Utilisez Firebase Auth via /login." },
    { status: 410 },
  );
}

export async function POST() {
  return NextResponse.json(
    { error: "NextAuth désactivé. Utilisez Firebase Auth via /login." },
    { status: 410 },
  );
}
