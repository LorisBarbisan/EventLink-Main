import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, ukToday } from "@shared/job-dates";
import { CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

type DueJob = { id: number; title: string; last_day: string };

function whenFinished(lastDay: string): string {
  if (lastDay === addDays(ukToday(), -1)) return "finished yesterday";
  return `finished on ${new Date(`${lastDay}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
  })}`;
}

/**
 * The day after a job's last day: "X finished yesterday. Mark it completed?"
 * Completing the job also moves its bookings forward; it never holds them
 * back. Unanswered jobs complete on their own 7 days after their last day.
 */
export function JobCompletionPrompt() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: due = [] } = useQuery<DueJob[]>({ queryKey: ["/api/jobs/completion-due"] });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["/api/jobs/completion-due"] });
    qc.invalidateQueries({ queryKey: ["/api/jobs"] });
  };
  const complete = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/jobs/${id}/complete`, { method: "PUT" }),
    onSuccess: () => {
      refresh();
      toast({ title: "Job marked completed", description: "Your crew can now be rated." });
    },
    onError: () => toast({ title: "Couldn't mark it completed", variant: "destructive" }),
  });
  const snooze = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/jobs/${id}/completion-snooze`, { method: "POST" }),
    onSuccess: refresh,
  });

  if (due.length === 0) return null;
  return (
    <div className="space-y-2">
      {due.map((j) => (
        <div
          key={j.id}
          className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
            <span>
              <strong>{j.title}</strong> {whenFinished(j.last_day)}. Mark it completed?
            </span>
          </p>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" onClick={() => complete.mutate(j.id)} disabled={complete.isPending}>
              Mark completed
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => snooze.mutate(j.id)}
              disabled={snooze.isPending}
            >
              Not yet
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
