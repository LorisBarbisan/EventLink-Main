import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useUndoableAction } from "@/hooks/useUndoableAction";
import { format } from "date-fns";
import { AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: any;
}

export function CancelBookingConfirmModal({ open, onOpenChange, booking }: Props) {
  const { executeWithUndo } = useUndoableAction();

  if (!booking) return null;

  const freelancerName = booking.freelancerName || "this freelancer";
  const eventDate = booking.eventDate
    ? format(new Date(booking.eventDate), "d MMM yyyy")
    : "the scheduled date";
  const hasBrief = !!booking.briefId || booking.status === "briefed";
  const previousStatus = booking.status;

  const handleConfirm = () => {
    onOpenChange(false);
    executeWithUndo(
      () =>
        apiRequest(`/api/bookings/${booking.id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: "cancelled" }),
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/bookings/calendar"] });
          queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
        }),
      () =>
        apiRequest(`/api/bookings/${booking.id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: previousStatus }),
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/bookings/calendar"] });
          queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
        }),
      "Booking cancelled"
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel this booking?</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will cancel the booking for{" "}
            <span className="font-medium text-foreground">{freelancerName}</span> on{" "}
            <span className="font-medium text-foreground">{eventDate}</span>. They will be
            notified by email.
          </p>
          {hasBrief && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                A brief has already been sent to this freelancer. They will receive a
                cancellation notification.
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Keep Booking
            </Button>
            <Button variant="destructive" onClick={handleConfirm}>
              Cancel Booking
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
