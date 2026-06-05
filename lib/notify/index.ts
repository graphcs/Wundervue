import "server-only";
import { getServiceClient } from "@/lib/ingest/persist";
import { canReceive, type NotificationPrefs, type NotificationType } from "./types";
import type { Plan } from "@/lib/auth/types";

export interface NotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  url?: string | null;
  listingId?: string | null;
  data?: Record<string, unknown> | null;
  // Stable per-(user, logical event) key; the unique index dedupes retries.
  dedupKey: string;
}

function toRow(n: NotificationInput) {
  return {
    user_id: n.userId,
    type: n.type,
    title: n.title,
    body: n.body ?? null,
    url: n.url ?? null,
    listing_id: n.listingId ?? null,
    data: n.data ?? null,
    dedup_key: n.dedupKey,
  };
}

// Write a batch of inbox notifications in one round-trip (the v1 channel).
// ON CONFLICT (user_id, dedup_key) DO NOTHING makes retries idempotent; the
// returned count is rows actually inserted. Callers pre-gate the audience.
// Email/push channels will fan out from here later (per-channel send after the
// inbox write), so keep all delivery flowing through this module.
export async function createNotifications(rows: NotificationInput[]): Promise<number> {
  if (rows.length === 0) return 0;
  const { data, error } = await getServiceClient()
    .from("notifications")
    .upsert(rows.map(toRow), { onConflict: "user_id,dedup_key", ignoreDuplicates: true })
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

// Single-row convenience that also applies plan/pref gating when context is
// provided. Returns true if a row was written (false if gated out or a dup).
export async function createNotification(
  args: NotificationInput & { plan?: Plan | null; prefs?: NotificationPrefs | null },
): Promise<boolean> {
  if (
    (args.plan !== undefined || args.prefs !== undefined) &&
    !canReceive(args.type, args.plan ?? null, args.prefs ?? null)
  ) {
    return false;
  }
  return (await createNotifications([args])) > 0;
}
