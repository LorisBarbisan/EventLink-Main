/** Application statuses that count as a filled position. */
export const FILLED_STATUSES = ["hired", "completed"] as const;

/** Crew count rules, shared by the job form, the server and the applicants list. */
export const MAX_POSITIONS = 50;

export type HireRefusal = "job_closed" | "fully_crewed" | null;

/**
 * Whether one more person can be hired. Checked on the server inside the hire
 * transaction; the interface uses the same rule only to stop offering it.
 */
export function hireRefusal(
  job: { status: string | null; positions: number },
  filled: number
): HireRefusal {
  if (job.status === "closed" || job.status === "completed") return "job_closed";
  if (filled >= Math.max(1, job.positions)) return "fully_crewed";
  return null;
}

/** After a hire: does it fill the last position (so the job closes itself)? */
export function fillsLastPosition(positions: number, filledAfter: number): boolean {
  return filledAfter >= Math.max(1, positions);
}

/** Days after the job's last day before it completes on its own. */
export const AUTO_COMPLETE_AFTER_DAYS = 7;
