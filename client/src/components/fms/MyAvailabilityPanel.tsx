import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, startOfToday, eachDayOfInterval, startOfWeek, endOfWeek, addWeeks } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Status = "available" | "tentative" | "unavailable";

interface AvailabilityRow {
  id: number;
  freelancerId: number;
  date: string;
  status: Status;
  note: string | null;
}

const STATUS_CYCLE: (Status | null)[] = ["available", "tentative", "unavailable", null];
const STATUS_COLOR: Record<Status, string> = {
  available: "bg-green-500 hover:bg-green-600",
  tentative: "bg-amber-400 hover:bg-amber-500",
  unavailable: "bg-red-500 hover:bg-red-600",
};
const STATUS_LABEL: Record<Status, string> = {
  available: "Available",
  tentative: "Tentative",
  unavailable: "Unavailable",
};

export function MyAvailabilityPanel() {
  const qc = useQueryClient();
  const today = startOfToday();
  const from = format(today, "yyyy-MM-dd");
  const to = format(addDays(today, 83), "yyyy-MM-dd"); // ~12 weeks

  const { data: rows = [] } = useQuery<AvailabilityRow[]>({
    queryKey: ["/api/availability/my", from, to],
    queryFn: () =>
      apiRequest(`/api/availability/my?from=${from}&to=${to}`).then((r) => r.json()),
    staleTime: 30_000,
  });

  const byDate = Object.fromEntries(rows.map((r) => [r.date, r]));

  const mutation = useMutation({
    mutationFn: ({ date, status }: { date: string; status: Status | null }) => {
      if (status === null) {
        // No DELETE endpoint yet — set to a no-op by re-querying; skip server call
        return Promise.resolve();
      }
      return apiRequest("/api/availability/my", { method: "PUT", body: JSON.stringify({ date, status }) }).then((r) => r.json());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/availability/my"] }),
  });

  const handleClick = (date: string) => {
    const current = byDate[date]?.status ?? null;
    const idx = STATUS_CYCLE.indexOf(current as Status | null);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    mutation.mutate({ date, status: next });
  };

  // Build 12 weeks of days, week by week (Mon–Sun)
  const weeks: Date[][] = [];
  let weekStart = startOfWeek(today, { weekStartsOn: 1 });
  for (let w = 0; w < 12; w++) {
    weeks.push(eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) }));
    weekStart = addWeeks(weekStart, 1);
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-3">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">My Availability</span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm bg-green-500" /> Available
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm bg-amber-400" /> Tentative
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm bg-red-500" /> Unavailable
          </span>
          <span className="ml-auto text-[11px]">Click a day to cycle status</span>
        </div>

        {/* Day-of-week header */}
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div className="space-y-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1">
              {week.map((day) => {
                const dateStr = format(day, "yyyy-MM-dd");
                const status = byDate[dateStr]?.status ?? null;
                const isPast = day < today;
                return (
                  <Tooltip key={dateStr}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => !isPast && handleClick(dateStr)}
                        disabled={isPast}
                        className={cn(
                          "h-8 w-full rounded-sm text-[10px] font-medium transition-colors",
                          isPast && "cursor-default opacity-30",
                          !isPast && status === null && "bg-muted hover:bg-muted-foreground/20",
                          !isPast && status && STATUS_COLOR[status],
                          status && "text-white"
                        )}
                      >
                        {format(day, "d")}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {format(day, "EEE d MMM")} — {status ? STATUS_LABEL[status] : "Not set"}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
