import { useQuery, useMutation } from "@tanstack/react-query";
import { format, addDays, startOfToday, eachDayOfInterval, startOfWeek, endOfWeek, addWeeks } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Status = "available" | "tentative" | "unavailable";

interface CrewRow {
  id: number;
  freelancerId: number;
  date: string;
  status: Status;
  note: string | null;
  freelancer_name: string;
  profile_photo_url: string | null;
}

const STATUS_COLOR: Record<Status, string> = {
  available: "bg-green-500",
  tentative: "bg-amber-400",
  unavailable: "bg-red-500",
};

export function CrewAvailabilityPanel() {
  const { toast } = useToast();
  const today = startOfToday();
  const from = format(today, "yyyy-MM-dd");
  const to = format(addDays(today, 83), "yyyy-MM-dd");

  const { data: rows = [], isLoading } = useQuery<CrewRow[]>({
    queryKey: ["/api/availability/crew", from, to],
    queryFn: () =>
      apiRequest(`/api/availability/crew?from=${from}&to=${to}`).then((r) => r.json()),
    staleTime: 60_000,
  });

  const inviteMutation = useMutation({
    mutationFn: () => apiRequest("/api/availability/invite", { method: "POST", body: "{}" }).then((r) => r.json()),
    onSuccess: (data: { sent: number }) => {
      toast({
        title: "Invitations sent",
        description: `${data.sent} crew member${data.sent !== 1 ? "s" : ""} notified.`,
      });
    },
    onError: () => {
      toast({ title: "Failed to send invites", variant: "destructive" });
    },
  });

  // Group rows by date → freelancerId → status
  const byDate: Record<string, Record<number, CrewRow>> = {};
  rows.forEach((r) => {
    byDate[r.date] ??= {};
    byDate[r.date][r.freelancerId] = r;
  });

  // Unique freelancers
  const freelancers = Array.from(
    new Map(rows.map((r) => [r.freelancerId, { id: r.freelancerId, name: r.freelancer_name, photo: r.profile_photo_url }])).values()
  );

  // Build 8 weeks
  const weeks: Date[][] = [];
  let weekStart = startOfWeek(today, { weekStartsOn: 1 });
  for (let w = 0; w < 8; w++) {
    weeks.push(eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) }));
    weekStart = addWeeks(weekStart, 1);
  }

  const allDays = weeks.flat();

  if (isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading crew availability…</div>;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold">Crew Availability</h3>
            <p className="text-xs text-muted-foreground">
              Availability your saved crew have marked for the next 8 weeks
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => inviteMutation.mutate()}
            disabled={inviteMutation.isPending}
          >
            <Bell className="h-4 w-4" />
            Invite Crew
          </Button>
        </div>

        {freelancers.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No crew availability yet. Click <strong>Invite Crew</strong> to ask your saved freelancers to mark their dates.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-max text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-background pr-3 text-left font-medium text-muted-foreground">
                    Freelancer
                  </th>
                  {allDays.map((day) => (
                    <th
                      key={format(day, "yyyy-MM-dd")}
                      className={cn(
                        "w-7 px-0.5 text-center font-normal text-muted-foreground",
                        format(day, "E") === "Sat" || format(day, "E") === "Sun"
                          ? "opacity-50"
                          : ""
                      )}
                    >
                      <div>{format(day, "d")}</div>
                      <div className="text-[9px]">{format(day, "MMM")}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {freelancers.map((f) => (
                  <tr key={f.id} className="border-t">
                    <td className="sticky left-0 z-10 bg-background py-1 pr-3 font-medium">
                      {f.name}
                    </td>
                    {allDays.map((day) => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const entry = byDate[dateStr]?.[f.id];
                      return (
                        <td key={dateStr} className="px-0.5 py-1 text-center">
                          {entry ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  className={cn(
                                    "inline-block h-5 w-5 rounded-sm",
                                    STATUS_COLOR[entry.status]
                                  )}
                                />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                {f.name} — {format(day, "EEE d MMM")}
                                <br />
                                {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                                {entry.note ? `: ${entry.note}` : ""}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="inline-block h-5 w-5 rounded-sm bg-muted opacity-30" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-green-500" /> Available</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-amber-400" /> Tentative</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-red-500" /> Unavailable</span>
        </div>
      </div>
    </TooltipProvider>
  );
}
