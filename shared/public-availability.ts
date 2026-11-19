import { addDays } from "./job-dates";

/**
 * The public calendar: what a client may see of a freelancer's availability.
 *
 * Only a date and one of three states ever leaves the server. Notes, external
 * calendar events and booking details never do. Unmarked dates are simply
 * absent — absence of data is not availability.
 */

/** The only shape availability may leave the server in, for anyone but its owner. */
export interface PublicAvailabilityDay {
  date: string; // yyyy-mm-dd
  state: "free" | "tentative" | "busy";
}

export interface PublicAvailability {
  from: string;
  to: string;
  days: PublicAvailabilityDay[];
  /** max(updated_at) of the freelancer's own marks in the window, or null */
  updated_at: string | null;
}

export const PUBLIC_WINDOW_DAYS = 90;

const STATE: Record<string, PublicAvailabilityDay["state"]> = {
  available: "free",
  tentative: "tentative",
  unavailable: "busy",
};

/**
 * Fold the freelancer's own marks and their confirmed booking dates into the
 * public view. Bookings contribute only as "busy" — a single bit — and win
 * over the freelancer's own mark for that day. A pick list, never a spread:
 * whatever else the input rows carry cannot reach the output.
 */
export function buildPublicAvailability(input: {
  from: string;
  to: string;
  marks: Array<{ date: string; status: string; updated_at: Date | string | null }>;
  bookedDates: string[];
}): PublicAvailability {
  const byDate = new Map<string, PublicAvailabilityDay["state"]>();
  let updated: string | null = null;
  for (const m of input.marks) {
    const date = String(m.date).slice(0, 10);
    if (date < input.from || date > input.to) continue;
    const state = STATE[m.status];
    if (!state) continue;
    byDate.set(date, state);
    if (m.updated_at) {
      const u = new Date(m.updated_at).toISOString();
      if (!updated || u > updated) updated = u;
    }
  }
  for (const d of input.bookedDates) {
    const date = d.slice(0, 10);
    if (date >= input.from && date <= input.to) byDate.set(date, "busy");
  }
  const days = [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, state]) => ({ date, state }));
  return { from: input.from, to: input.to, days, updated_at: updated };
}

/** Every date from start to end inclusive (yyyy-mm-dd). */
export function datesBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start, i = 0; d <= end && i < 400; d = addDays(d, 1), i++) out.push(d);
  return out;
}

/**
 * The profile response: the public calendar is attached only when the
 * freelancer has switched it on — otherwise there is no key at all (not an
 * empty array, which would confirm the feature exists for them). The setting
 * itself is shown only to its owner.
 */
export function withPublicAvailability<T extends Record<string, unknown>>(
  profile: T,
  opts: { isOwner: boolean; availability: PublicAvailability | null }
): Omit<T, "show_calendar_publicly"> & { public_availability?: PublicAvailability } {
  const out: Record<string, unknown> = { ...profile };
  if (!opts.isOwner) delete out.show_calendar_publicly;
  if (profile.show_calendar_publicly && opts.availability) {
    out.public_availability = opts.availability;
  }
  return out as Omit<T, "show_calendar_publicly"> & { public_availability?: PublicAvailability };
}
