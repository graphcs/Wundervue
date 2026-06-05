// Shared definitions for the listing "Report an issue" flow, imported by both
// the client modal and the API route so the option list and validation can't
// drift apart.
export const REPORT_ISSUE_TYPES = [
  { id: "wrong-datetime", label: "Wrong date or time" },
  { id: "wrong-venue", label: "Wrong venue or address" },
  { id: "wrong-price", label: "Wrong price or deal" },
  { id: "not-happening", label: "Event no longer happening" },
  { id: "other", label: "Something else" },
] as const;

export type ReportIssueType = (typeof REPORT_ISSUE_TYPES)[number]["id"];

export const REPORT_ISSUE_IDS: readonly string[] = REPORT_ISSUE_TYPES.map((t) => t.id);

export const REPORT_NOTE_MAX = 2000;
export const REPORT_EMAIL_MAX = 320;
