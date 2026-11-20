/** Booking statuses that mean the work is on, so it belongs in the freelancer's books. */
export const EARNING_BOOKING_STATUSES = ["confirmed", "briefed", "completed"] as const;

export function bookingNeedsEarningsEntry(status: string | null | undefined): boolean {
  return (EARNING_BOOKING_STATUSES as readonly string[]).includes(status ?? "");
}
