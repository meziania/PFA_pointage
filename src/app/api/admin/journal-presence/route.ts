import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, requireAdmin } from "@/lib/server/api-auth";
import { listJournalPresenceAdmin, listPointagesAdmin } from "@/lib/server/presence-journal";

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  userId: z.string().optional(),
  mode: z.enum(["pointages", "presence"]).default("presence"),
});

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const url = new URL(request.url);
    const parsed = querySchema.parse({
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      userId: url.searchParams.get("userId") || undefined,
      mode: url.searchParams.get("mode") || "presence",
    });

    if (parsed.from > parsed.to) {
      return NextResponse.json({ error: "La date de début doit être antérieure à la date de fin." }, { status: 400 });
    }

    if (parsed.mode === "pointages") {
      const pointages = await listPointagesAdmin({
        fromYmd: parsed.from,
        toYmd: parsed.to,
        userId: parsed.userId,
        limit: 2000,
      });
      return NextResponse.json({ mode: "pointages", pointages, count: pointages.length });
    }

    const journal = await listJournalPresenceAdmin({
      fromYmd: parsed.from,
      toYmd: parsed.to,
      userId: parsed.userId,
    });
    return NextResponse.json({ mode: "presence", journal, count: journal.length });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
