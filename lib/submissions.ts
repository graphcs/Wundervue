// Shared definitions for the public Submit + Work With Us flows, imported by
// both the client forms and the API routes so option lists and validation can't
// drift apart.

export const SUBMISSION_KINDS = [
  { id: "event", label: "Event" },
  { id: "deal", label: "Deal" },
] as const;
export type SubmissionKind = (typeof SUBMISSION_KINDS)[number]["id"];
export const SUBMISSION_KIND_IDS: readonly string[] = SUBMISSION_KINDS.map((k) => k.id);

export const INQUIRY_TYPES = [
  { id: "partnership", label: "Partnership" },
  { id: "advertise", label: "Advertise / Sponsor" },
  { id: "media", label: "Media / Press" },
  { id: "other", label: "Something else" },
] as const;
export type InquiryType = (typeof INQUIRY_TYPES)[number]["id"];
export const INQUIRY_TYPE_IDS: readonly string[] = INQUIRY_TYPES.map((t) => t.id);

// Field length caps (shared client + server).
export const TITLE_MAX = 200;
export const DESCRIPTION_MAX = 2000;
export const NAME_MAX = 120;
export const EMAIL_MAX = 320;
export const URL_MAX = 500;
export const SHORT_TEXT_MAX = 200;
export const MESSAGE_MAX = 2000;

// Trim + cap a free-text field, or null when empty. Shared by both routes.
export function cleanField(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}
