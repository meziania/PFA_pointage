import { apiFetch } from "@/lib/api-client";
import type { JournalPresenceDoc, PointageDoc } from "@/lib/data-model";

export type JournalPresenceMode = "presence" | "pointages";

export async function fetchAdminJournal(params: {
  from: string;
  to: string;
  userId?: string;
  mode?: JournalPresenceMode;
}): Promise<
  | { mode: "presence"; journal: Array<JournalPresenceDoc & { id: string }>; count: number }
  | { mode: "pointages"; pointages: Array<PointageDoc & { id: string }>; count: number }
> {
  const qs = new URLSearchParams({
    from: params.from,
    to: params.to,
    mode: params.mode ?? "presence",
  });
  if (params.userId) qs.set("userId", params.userId);
  return apiFetch(`/api/admin/journal-presence?${qs.toString()}`);
}
