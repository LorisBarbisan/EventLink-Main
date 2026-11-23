import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, addMonths, startOfMonth, ukToday } from "@shared/job-dates";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type Status = "available" | "tentative" | "unavailable";

interface AvailabilityEntry {
  date: string;
  status: Status;
}

interface GigEntry {
  work_date: string;
  work_end_date?: string | null;
  work_status: string;
}

// Same colours and words as the desktop calendar
const STATUSES: { value: Status; label: string; cell: string; button: string }[] = [
  {
    value: "available",
    label: "Available",
    cell: "bg-green-600 text-white",
    button: "bg-green-600 hover:bg-green-700 text-white",
  },
  {
    value: "tentative",
    label: "Tentative",
    cell: "bg-amber-600 text-white",
    button: "bg-amber-600 hover:bg-amber-700 text-white",
  },
  {
    value: "unavailable",
    label: "Unavailable",
    cell: "bg-red-600 text-white",
    button: "bg-red-600 hover:bg-red-700 text-white",
  },
];

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** 0 = Monday … 6 = Sunday, for a YYYY-MM-DD date */
function weekdayMon(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

function monthLabel(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function dayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/**
 * Availability on a phone: one month at a time, tap a day to mark it. The
 * rest of the calendar (bookings, gigs, sync) stays on the computer; days
 * with a gig carry a dot so a working day isn't marked free by mistake.
 */
export function MobileAvailability() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const today = ukToday();
  const [month, setMonth] = useState(() => startOfMonth(today));
  const [picked, setPicked] = useState<string | null>(null);

  const from = month;
  const to = addDays(addMonths(month, 1), -1);

  const { data: avail = [] } = useQuery<AvailabilityEntry[]>({
    queryKey: ["/api/calendar/availability", from, to],
    queryFn: () => apiRequest(`/api/calendar/availability?from=${from}&to=${to}`),
  });
  const { data: gigs = [] } = useQuery<GigEntry[]>({
    queryKey: ["/api/earnings/gigs", from, to],
    queryFn: () => apiRequest(`/api/earnings/gigs?from=${from}&to=${to}`),
  });

  const byDate = useMemo(() => new Map(avail.map((a) => [a.date, a.status])), [avail]);
  const gigDays = useMemo(() => {
    const s = new Set<string>();
    for (const g of gigs) {
      if (g.work_status === "cancelled") continue;
      const end = g.work_end_date && g.work_end_date > g.work_date ? g.work_end_date : g.work_date;
      for (let d = g.work_date; d <= end; d = addDays(d, 1)) s.add(d);
    }
    return s;
  }, [gigs]);

  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  const lead = weekdayMon(from);

  // Prefix keys, so the desktop calendar's wider range refreshes too
  const refresh = () => qc.invalidateQueries({ queryKey: ["/api/calendar/availability"] });

  const setMut = useMutation({
    mutationFn: ({ date, status }: { date: string; status: Status }) =>
      apiRequest("/api/calendar/availability", {
        method: "PUT",
        body: JSON.stringify({ date, status, note: null }),
      }),
    onSuccess: () => {
      refresh();
      setPicked(null);
    },
    onError: () => toast({ title: "Couldn't save that day", variant: "destructive" }),
  });
  const clearMut = useMutation({
    mutationFn: (date: string) =>
      apiRequest(`/api/calendar/availability/${date}`, { method: "DELETE" }),
    onSuccess: () => {
      refresh();
      setPicked(null);
    },
    onError: () => toast({ title: "Couldn't clear that day", variant: "destructive" }),
  });
  const busy = setMut.isPending || clearMut.isPending;
  const pickedStatus = picked ? byDate.get(picked) : undefined;

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Availability</p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              aria-label="Previous month"
              disabled={month <= startOfMonth(today)}
              onClick={() => setMonth(addMonths(month, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="w-32 text-center text-sm font-medium">{monthLabel(month)}</p>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              aria-label="Next month"
              onClick={() => setMonth(addMonths(month, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((w, i) => (
            <span key={i} className="text-xs text-muted-foreground">
              {w}
            </span>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <span key={`pad-${i}`} />
          ))}
          {days.map((d) => {
            const status = byDate.get(d);
            const style = STATUSES.find((s) => s.value === status);
            const past = d < today;
            return (
              <button
                key={d}
                type="button"
                disabled={past}
                onClick={() => setPicked(d)}
                aria-label={`${dayLabel(d)}${style ? `, ${style.label}` : ""}${gigDays.has(d) ? ", gig booked" : ""}`}
                className={`relative flex h-10 items-center justify-center rounded-md text-sm tabular-nums transition-colors ${
                  style ? style.cell : "bg-muted/50 hover:bg-muted"
                } ${past ? "opacity-40" : ""} ${d === today ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}`}
              >
                {Number(d.slice(8))}
                {gigDays.has(d) && (
                  <span
                    className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${style ? "bg-white" : "bg-sky-700"}`}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {STATUSES.map((s) => (
            <span key={s.value} className="flex items-center gap-1">
              <span className={`h-2.5 w-2.5 rounded-sm ${s.cell}`} />
              {s.label}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-700" />
            Gig
          </span>
        </div>
      </CardContent>

      <Sheet open={!!picked} onOpenChange={(o) => !o && setPicked(null)}>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader className="text-left">
            <SheetTitle>{picked ? dayLabel(picked) : ""}</SheetTitle>
            <SheetDescription>
              {picked && gigDays.has(picked)
                ? "You have a gig logged this day."
                : "Mark how this day looks for you."}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 grid gap-2">
            {STATUSES.map((s) => (
              <Button
                key={s.value}
                className={`h-12 text-base ${s.button} ${pickedStatus === s.value ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : ""}`}
                disabled={busy}
                onClick={() => picked && setMut.mutate({ date: picked, status: s.value })}
              >
                {s.label}
              </Button>
            ))}
            {pickedStatus && (
              <Button
                variant="outline"
                className="h-12 text-base"
                disabled={busy}
                onClick={() => picked && clearMut.mutate(picked)}
              >
                Clear
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  );
}
