/**
 * Overtime from logged time entries. Pure arithmetic shared by the time-entries
 * summary endpoint and invoice creation, so a freelancer's invoice bills the
 * same overtime the Books screen shows them.
 *
 *   worked (per day) = finish − start − break, clamped at 0 (overnight wraps)
 *   overtime (day)   = max(0, worked − standard hours), only when a standard
 *                      working day is set; otherwise unknown (null)
 *   overtime hours   = total overtime minutes → hours, to 2dp
 *   overtime pence   = overtime hours × the entry's overtime rate, when a rate
 *                      is set; otherwise unknown (null)
 */

export interface TimeEntryInput {
  start_time: string; // "HH:MM"
  finish_time: string; // "HH:MM"
  break_minutes: number;
}

export interface OvertimeSettings {
  standard_hours_per_day: number | null | undefined;
  overtime_rate_pence: number | null | undefined;
}

export interface OvertimeDay {
  worked_minutes: number;
  /** null when no standard working day is set, so overtime can't be known. */
  overtime_minutes: number | null;
}

export interface OvertimeResult {
  per_day: OvertimeDay[];
  total_worked_minutes: number;
  /** True when a standard working day is set, so overtime is meaningful. */
  has_standard: boolean;
  /** 0 when no standard day is set (overtime unknown). */
  total_overtime_minutes: number;
  /** total_overtime_minutes as hours, to 2dp. */
  overtime_hours: number;
  /** null when the entry has no overtime rate. */
  overtime_pence: number | null;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

export function workedMinutes(start: string, finish: string, breakMin: number): number {
  let mins = timeToMinutes(finish) - timeToMinutes(start);
  if (mins < 0) mins += 24 * 60; // overnight
  return Math.max(0, mins - breakMin);
}

export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

export function computeOvertime(
  entries: TimeEntryInput[],
  settings: OvertimeSettings
): OvertimeResult {
  const standardMinutes = settings.standard_hours_per_day
    ? settings.standard_hours_per_day * 60
    : null;

  let totalWorkedMinutes = 0;
  let totalOvertimeMinutes = 0;

  const per_day: OvertimeDay[] = entries.map((r) => {
    const worked = workedMinutes(r.start_time, r.finish_time, r.break_minutes);
    totalWorkedMinutes += worked;
    const overtime = standardMinutes !== null ? Math.max(0, worked - standardMinutes) : null;
    if (overtime !== null) totalOvertimeMinutes += overtime;
    return { worked_minutes: worked, overtime_minutes: overtime };
  });

  const overtimeHours = minutesToHours(totalOvertimeMinutes);
  const rate = settings.overtime_rate_pence;
  const overtimePence =
    rate !== null && rate !== undefined ? Math.round(overtimeHours * rate) : null;

  return {
    per_day,
    total_worked_minutes: totalWorkedMinutes,
    has_standard: standardMinutes !== null,
    total_overtime_minutes: totalOvertimeMinutes,
    overtime_hours: overtimeHours,
    overtime_pence: overtimePence,
  };
}
