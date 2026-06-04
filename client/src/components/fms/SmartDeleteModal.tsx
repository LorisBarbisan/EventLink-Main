import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Loader2, Users } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: number | null;
  jobTitle?: string;
  onDeleted?: () => void;
}

export function SmartDeleteModal({ open, onOpenChange, jobId, jobTitle, onDeleted }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<"summary" | "deleting">("summary");

  const { data: summary, isLoading: summaryLoading } = useQuery<{
    enquiryCount: number;
    confirmedBookingCount: number;
    confirmedBookings: { id: number; freelancerName: string }[];
  }>({
    queryKey: ["/api/jobs", jobId, "activity-summary"],
    queryFn: () => apiRequest(`/api/jobs/${jobId}/activity-summary`),
    enabled: open && !!jobId,
  });

  const cancelAndDeleteMutation = useMutation({
    mutationFn: async () => {
      if (!jobId) throw new Error("No job ID");
      await apiRequest(`/api/jobs/${jobId}/cancel-all-bookings`, { method: "POST" });
      await apiRequest(`/api/jobs/${jobId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/calendar"] });
      toast({ title: "Job deleted", description: "All bookings cancelled and job removed." });
      onOpenChange(false);
      onDeleted?.();
    },
    onError: () => {
      toast({ title: "Delete failed", variant: "destructive" });
    },
  });

  const closeJobMutation = useMutation({
    mutationFn: async () => {
      if (!jobId) throw new Error("No job ID");
      await apiRequest(`/api/jobs/${jobId}/close`, { method: "PATCH" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job closed", description: "The job has been closed instead of deleted." });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Close failed", variant: "destructive" });
    },
  });

  const hasActiveActivity =
    (summary?.enquiryCount ?? 0) > 0 || (summary?.confirmedBookingCount ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Delete Job</DialogTitle>
        </DialogHeader>

        {summaryLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You are about to delete{" "}
              <span className="font-medium text-foreground">"{jobTitle}"</span>.
            </p>

            {hasActiveActivity && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    This job has active activity
                  </p>
                </div>
                <div className="space-y-2 text-sm text-amber-700 dark:text-amber-300">
                  {(summary?.enquiryCount ?? 0) > 0 && (
                    <p>• {summary!.enquiryCount} open availability enquir{summary!.enquiryCount === 1 ? "y" : "ies"}</p>
                  )}
                  {(summary?.confirmedBookingCount ?? 0) > 0 && (
                    <div>
                      <p>• {summary!.confirmedBookingCount} confirmed booking{summary!.confirmedBookingCount === 1 ? "" : "s"}:</p>
                      <div className="mt-1 ml-3 flex flex-wrap gap-1">
                        {summary!.confirmedBookings.map((b) => (
                          <Badge key={b.id} variant="outline" className="text-xs">
                            <Users className="h-2.5 w-2.5 mr-1" />
                            {b.freelancerName}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              {hasActiveActivity ? (
                <>
                  <Button
                    variant="destructive"
                    onClick={() => cancelAndDeleteMutation.mutate()}
                    disabled={cancelAndDeleteMutation.isPending}
                  >
                    {cancelAndDeleteMutation.isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Cancel Bookings & Delete Job
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => closeJobMutation.mutate()}
                    disabled={closeJobMutation.isPending}
                  >
                    {closeJobMutation.isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Close Job Instead (keep bookings)
                  </Button>
                </>
              ) : (
                <Button
                  variant="destructive"
                  onClick={() => cancelAndDeleteMutation.mutate()}
                  disabled={cancelAndDeleteMutation.isPending}
                >
                  {cancelAndDeleteMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Delete Job
                </Button>
              )}
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
