/** Reporting a person. The category is what makes patterns visible. */
export const REPORT_CATEGORIES = [
  { value: "unsafe_site", label: "Unsafe site or not as described" },
  { value: "unpaid", label: "Didn't pay" },
  { value: "no_show", label: "Didn't turn up" },
  { value: "abusive_messages", label: "Abusive or unwanted messages" },
  { value: "credentials_mismatch", label: "Credentials don't match the person" },
  { value: "other", label: "Something else" },
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number]["value"];

export function isReportCategory(v: unknown): v is ReportCategory {
  return REPORT_CATEGORIES.some((c) => c.value === v);
}

export const REPORT_STATUSES = ["open", "reviewing", "actioned", "dismissed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** Bookings in these states keep their thread open through a block. */
export const ACTIVE_BOOKING_STATUSES = ["confirmed", "briefed"] as const;

/**
 * Whether a message may be sent between two people. A block (either way)
 * stops it — unless they have an active booking together, so a block never
 * silently cuts off call times and site details for a job in progress.
 */
export function messagingAllowed(opts: { blocked: boolean; activeBooking: boolean }): boolean {
  return !opts.blocked || opts.activeBooking;
}
