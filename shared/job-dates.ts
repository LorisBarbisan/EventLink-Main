/**
 * Calendar dates (YYYY-MM-DD) for jobs.
 *
 * A job date is a day on a UK calendar, not an instant in time, so it never
 * becomes a Date object here: no time zone, no UTC round trip, no BST/GMT
 * changeover to cross. Arithmetic is done on the year/month/day numbers.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Days since 1970-01-01 for a civil date (proleptic Gregorian). */
function toDays(y: number, m: number, d: number): number {
  // Howard Hinnant's days_from_civil
  y -= m <= 2 ? 1 : 0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Civil date for a day count since 1970-01-01. */
function fromDays(z: number): [number, number, number] {
  z += 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365
  );
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  return [yoe + era * 400 + (m <= 2 ? 1 : 0), m, d];
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** A valid YYYY-MM-DD (first 10 chars of the input), or null. */
export function parseCalendarDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = String(s).slice(0, 10).match(ISO_DATE);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1) return null;
  // round-trips only if the day exists in that month (rejects 2026-02-30)
  const [ry, rm, rd] = fromDays(toDays(y, mo, d));
  if (ry !== y || rm !== mo || rd !== d) return null;
  return `${pad(y, 4)}-${pad(mo)}-${pad(d)}`;
}

/** Add whole days to a YYYY-MM-DD date, without going through Date. */
export function addDays(iso: string, days: number): string {
  const valid = parseCalendarDate(iso);
  if (!valid) throw new Error(`Not a calendar date: ${iso}`);
  const [y, m, d] = valid.split("-").map(Number);
  const [ny, nm, nd] = fromDays(toDays(y, m, d) + days);
  return `${pad(ny, 4)}-${pad(nm)}-${pad(nd)}`;
}

/** Whole days from a to b (b − a), both YYYY-MM-DD. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return toDays(by, bm, bd) - toDays(ay, am, ad);
}

/**
 * The last day a job runs: its end date, or its start plus any duration in
 * days, or its start. Nothing else computes a last day for itself.
 * Returns YYYY-MM-DD, or null when the job has no usable start date.
 */
export function jobLastDay(job: {
  event_date: string | null | undefined;
  end_date?: string | null;
  duration_type?: string | null;
  days?: number | null;
}): string | null {
  const end = parseCalendarDate(job.end_date);
  if (end) return end;
  const start = parseCalendarDate(job.event_date);
  if (!start) return null;
  if (job.duration_type === "days" && job.days && job.days > 1) {
    return addDays(start, job.days - 1);
  }
  return start;
}

/**
 * Today's date in the UK, as YYYY-MM-DD. The one place an instant becomes a
 * calendar date, and it names the zone explicitly. (en-CA formats as
 * YYYY-MM-DD.)
 */
export function ukToday(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

/** True once the job's last day is over (i.e. today is after it). */
export function jobHasFinished(
  job: Parameters<typeof jobLastDay>[0],
  today: string = ukToday()
): boolean {
  const last = jobLastDay(job);
  return last != null && last < today;
}

/**
 * The UK calendar date of an instant (a timestamp such as paid_at or
 * created_at), as YYYY-MM-DD. Never toISOString().slice(0, 10): that is the
 * UTC date, which between midnight and 01:00 in British Summer Time is still
 * yesterday — enough to move income into the previous tax year.
 */
export function ukDate(instant: Date | string | number): string {
  return ukToday(instant instanceof Date ? instant : new Date(instant));
}

/** The last day of the month after the given date's month (YYYY-MM-DD). */
export function endOfFollowingMonth(iso: string): string {
  const valid = parseCalendarDate(iso);
  if (!valid) throw new Error(`Not a calendar date: ${iso}`);
  const [y, m] = valid.split("-").map(Number);
  // first day of the month two ahead, minus one day
  const y2 = m >= 11 ? y + 1 : y;
  const m2 = ((m + 1) % 12) + 1;
  return addDays(`${String(y2).padStart(4, "0")}-${String(m2).padStart(2, "0")}-01`, -1);
}

/**
 * Add whole months to a YYYY-MM-DD date, clamping to the month's last day
 * (31 Jan + 1 month = 28/29 Feb). Returns "" for an unusable input.
 */
export function addMonths(iso: string, months: number): string {
  const valid = parseCalendarDate(iso);
  if (!valid) return "";
  const [y, m, d] = valid.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const first = `${String(ny).padStart(4, "0")}-${String(nm).padStart(2, "0")}-01`;
  const lastDay = Number(endOfFollowingMonth(addDays(first, -1)).slice(8)); // days in month nm
  return `${first.slice(0, 8)}${String(Math.min(d, lastDay)).padStart(2, "0")}`;
}

/** First day of the month of a YYYY-MM-DD date. */
export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}
