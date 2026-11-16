const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-03-07" → "7 Mar 2026". Reads the date part only, so no timezone shift. */
export function fmtDate(d: string | Date | null | undefined, empty = ""): string {
  if (!d) return empty;
  const s = typeof d === "string" ? d : d.toISOString();
  const [y, m, day] = s.slice(0, 10).split("-");
  return `${parseInt(day)} ${MONTHS[parseInt(m) - 1]} ${y}`;
}
