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
  const iso = (s: string | null | undefined) => {
    if (!s) return null;
    const d = new Date(`${s.slice(0, 10)}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const end = iso(job.end_date);
  if (end) return end.toISOString().slice(0, 10);
  const start = iso(job.event_date);
  if (!start) return null;
  if (job.duration_type === "days" && job.days && job.days > 1) {
    start.setUTCDate(start.getUTCDate() + job.days - 1);
  }
  return start.toISOString().slice(0, 10);
}

/** Today's date in the UK, as YYYY-MM-DD. */
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
