import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicAvailability } from "@shared/public-availability";

type State = "free" | "tentative" | "busy";

const CELL: Record<State | "none", string> = {
  free: "bg-green-500/80 text-white",
  tentative: "bg-amber-400/80 text-amber-950",
  busy: "bg-slate-400/70 text-white dark:bg-slate-600",
  none: "bg-muted text-muted-foreground",
};
const LABEL: Record<State, string> = { free: "Free", tentative: "Maybe — ask", busy: "Busy" };

const iso = (d: Date) => d.toISOString().slice(0, 10);
// Calendar dates are pinned to UTC midnight and always formatted with
// timeZone "UTC" below, so the day printed is the day stored — whatever the
// viewer's zone. Do not "correct" those to local or Europe/London.
const utc = (s: string) => new Date(`${s}T00:00:00Z`);

/** "Availability updated 3 days ago" / "Last updated on 2 November — worth checking" */
export function stalenessLine(updatedAt: string | null, now: Date = new Date()): string {
  if (!updatedAt) return "No days marked yet";
  const days = Math.floor((now.getTime() - new Date(updatedAt).getTime()) / 86_400_000);
  if (days > 14) {
    const when = new Date(updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
    return `Last updated on ${when} — worth checking`;
  }
  if (days <= 0) return "Availability updated today";
  if (days === 1) return "Availability updated yesterday";
  return `Availability updated ${days} days ago`;
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {(["free", "tentative", "busy"] as State[]).map((s) => (
        <span key={s} className="flex items-center gap-1">
          <span className={`inline-block h-3 w-3 rounded-sm ${CELL[s]}`} /> {LABEL[s]}
        </span>
      ))}
      <span className="flex items-center gap-1">
        <span className={`inline-block h-3 w-3 rounded-sm ${CELL.none}`} /> Not marked
      </span>
    </div>
  );
}

/** Profile: a month view within the 90-day window. */
/** fluid: fill the container width, with cells that grow in width but keep a sensible height. */
export function PublicAvailabilityMonth({
  data,
  fluid = false,
}: {
  data: PublicAvailability;
  fluid?: boolean;
}) {
  const states = useMemo(() => new Map(data.days.map((d) => [d.date, d.state])), [data]);
  const first = utc(data.from);
  const [offset, setOffset] = useState(0);
  const month = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + offset, 1));
  const lastMonth = utc(data.to);
  const canBack = offset > 0;
  const canForward =
    month.getUTCFullYear() * 12 + month.getUTCMonth() <
    lastMonth.getUTCFullYear() * 12 + lastMonth.getUTCMonth();

  const lead = (month.getUTCDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(
    Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)
  ).getUTCDate();
  const cells: Array<string | null> = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      iso(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), i + 1)))
    ),
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11"
          disabled={!canBack}
          onClick={() => setOffset((o) => o - 1)}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {month.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11"
          disabled={!canForward}
          onClick={() => setOffset((o) => o + 1)}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <span key={`b${i}`} />;
          const inWindow = date >= data.from && date <= data.to;
          const state = states.get(date);
          return (
            <span
              key={date}
              title={inWindow ? (state ? LABEL[state] : "Not marked") : undefined}
              className={`flex items-center justify-center rounded tabular-nums ${
                fluid ? "h-10 text-sm sm:h-12 lg:h-14" : "aspect-square text-xs"
              } ${inWindow ? CELL[state ?? "none"] : "text-muted-foreground/40"}`}
            >
              {Number(date.slice(8))}
            </span>
          );
        })}
      </div>
      <Legend />
      <p className="text-xs text-muted-foreground">{stalenessLine(data.updated_at)}</p>
    </div>
  );
}

/** Card: the next 30 days as a strip, with a one-line summary. */
export function PublicAvailabilityStrip({
  data,
  showUpdated = true,
}: {
  data: PublicAvailability;
  /** Off when a month view below already says when it was updated */
  showUpdated?: boolean;
}) {
  const states = new Map(data.days.map((d) => [d.date, d.state]));
  const start = utc(data.from);
  const next30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    return iso(d);
  });
  const free = next30.filter((d) => states.get(d) === "free").length;
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">Free {free} of the next 30 days</p>
      <div className="flex gap-[2px]">
        {next30.map((d) => {
          const s = states.get(d);
          return (
            <span
              key={d}
              title={`${utc(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}: ${s ? LABEL[s] : "Not marked"}`}
              className={`h-4 flex-1 rounded-[2px] ${CELL[s ?? "none"]}`}
            />
          );
        })}
      </div>
      {showUpdated && (
        <p className="text-[11px] text-muted-foreground">{stalenessLine(data.updated_at)}</p>
      )}
    </div>
  );
}
