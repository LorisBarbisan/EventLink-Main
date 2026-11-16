/**
 * Where an earning or expense came from, for the origin filter.
 * "eventlink": through a booking on the platform. "imported": from an import
 * batch. "mine": typed in (or from an invoice / receipt you created).
 */
export type Origin = "eventlink" | "imported" | "mine";
export type OriginFilter = "all" | Origin;

export function originOf(r: { source?: string | null; booking_id?: number | null }): Origin {
  if (r.booking_id != null || r.source === "booking") return "eventlink";
  if (r.source === "imported") return "imported";
  return "mine";
}

export function matchesOrigin(
  r: { source?: string | null; booking_id?: number | null },
  filter: OriginFilter
): boolean {
  return filter === "all" || originOf(r) === filter;
}

export const ORIGIN_OPTIONS: { value: OriginFilter; label: string }[] = [
  { value: "all", label: "All sources" },
  { value: "eventlink", label: "EventLink jobs" },
  { value: "imported", label: "Imported" },
  { value: "mine", label: "Added by me" },
];
