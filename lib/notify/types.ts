import type { Plan } from "@/lib/auth/types";

export type NotificationType =
  | "monthly_favorites"
  | "new_drops"
  | "weekly_recs"
  | "venue_alerts"
  | "early_access";

export type NotificationTier = "basic" | "advanced";

// Single source of truth for the notification catalog: tier (basic = free +
// Insider; advanced = Insider only) and the labels the prefs UI renders. Adding
// a type here updates gating, the UI rows, and defaults together.
export interface NotificationMeta {
  type: NotificationType;
  tier: NotificationTier;
  label: string;
  desc: string;
}

export const NOTIFICATION_META: readonly NotificationMeta[] = [
  { type: "monthly_favorites", tier: "basic", label: "Monthly saved-events summary", desc: "A monthly recap of your upcoming saved events" },
  { type: "new_drops", tier: "advanced", label: "New event drops", desc: "New events matching your interests" },
  { type: "weekly_recs", tier: "advanced", label: "Weekly picks", desc: "Personalized recommendations each week" },
  { type: "venue_alerts", tier: "advanced", label: "Venue alerts", desc: "New events at venues you follow" },
  { type: "early_access", tier: "advanced", label: "Early access", desc: "First dibs on Insider events and deals" },
];

export const BASIC_TYPES: readonly NotificationType[] = NOTIFICATION_META.filter((m) => m.tier === "basic").map((m) => m.type);
export const ADVANCED_TYPES: readonly NotificationType[] = NOTIFICATION_META.filter((m) => m.tier === "advanced").map((m) => m.type);

export type NotificationPrefs = Partial<Record<NotificationType, boolean>>;

// Default on/off when a user hasn't explicitly set a pref.
export const DEFAULT_PREFS: Record<NotificationType, boolean> = Object.fromEntries(
  NOTIFICATION_META.map((m) => [m.type, true]),
) as Record<NotificationType, boolean>;

export function isAdvanced(type: NotificationType): boolean {
  return ADVANCED_TYPES.includes(type);
}

// Whether a user with this plan + prefs should receive a notification of `type`.
// Advanced types require Insider regardless of the pref toggle.
export function canReceive(
  type: NotificationType,
  plan: Plan | null | undefined,
  prefs: NotificationPrefs | null | undefined,
): boolean {
  if (isAdvanced(type) && plan !== "insider") return false;
  return prefs?.[type] ?? DEFAULT_PREFS[type];
}
