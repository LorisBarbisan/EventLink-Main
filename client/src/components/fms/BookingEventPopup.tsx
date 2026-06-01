import { useLocation } from "wouter";
import { format } from "date-fns";
import { Calendar, Clock, MapPin, Briefcase, PoundSterling } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STATUS_COLOURS: Record<string, { bg: string; label: string }> = {
  enquired:  { bg: "#FFF3E0", label: "#E65100" },
  confirmed: { bg: "#E8F5E9", label: "#1A6B3C" },
  briefed:   { bg: "#E8EAF6", label: "#1E3A5F" },
  completed: { bg: "#F3F4F6", label: "#374151" },
  cancelled: { bg: "#FEE2E2", label: "#DC2626" },
};

interface Booking {
  id: number;
  status: string;
  freelancerName: string;
  freelancerPhoto: string | null;
  freelancerTitle: string | null;
  eventDate?: string | null;
  callTime?: string | null;
  venueAddress?: string | null;
  agreedRate?: string | null;
  employerNotes?: string | null;
  jobId?: number | null;
}

interface Props {
  booking: Booking;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function DetailRow({ icon: Icon, value }: { icon: any; value: string }) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <span className="text-gray-700">{value}</span>
    </div>
  );
}

function Avatar({ name, photo }: { name: string; photo: string | null }) {
  if (photo) {
    return (
      <img
        src={photo}
        alt={name}
        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
      />
    );
  }
  const initials = name
    .split(" ")
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600 flex-shrink-0">
      {initials}
    </div>
  );
}

export function BookingEventPopup({ booking, open, onOpenChange }: Props) {
  const [, navigate] = useLocation();
  const colours = STATUS_COLOURS[booking.status] ?? STATUS_COLOURS.completed;

  const formatDate = (d: string) => {
    try { return format(new Date(d), "EEE d MMMM yyyy"); } catch { return d; }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar name={booking.freelancerName || "?"} photo={booking.freelancerPhoto} />
            <div className="min-w-0">
              <DialogTitle className="text-base leading-tight">
                {booking.freelancerName || "Unnamed freelancer"}
              </DialogTitle>
              {booking.freelancerTitle && (
                <p className="text-xs text-muted-foreground mt-0.5">{booking.freelancerTitle}</p>
              )}
            </div>
            <span
              className="ml-auto px-2 py-0.5 rounded-full text-xs font-semibold capitalize flex-shrink-0"
              style={{ background: colours.bg, color: colours.label }}
            >
              {booking.status}
            </span>
          </div>
        </DialogHeader>

        <div className="space-y-2.5 py-1">
          {booking.eventDate && (
            <DetailRow icon={Calendar} value={formatDate(booking.eventDate)} />
          )}
          {booking.callTime && (
            <DetailRow icon={Clock} value={`Call time: ${booking.callTime}`} />
          )}
          {booking.venueAddress && (
            <DetailRow icon={MapPin} value={booking.venueAddress} />
          )}
          {booking.agreedRate && (
            <DetailRow icon={PoundSterling} value={booking.agreedRate} />
          )}
        </div>

        {booking.employerNotes && (
          <div className="rounded-md bg-gray-50 px-3 py-2.5 text-sm">
            <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
            <p className="text-gray-700">{booking.employerNotes}</p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            className="bg-orange-500 hover:bg-orange-600"
            onClick={() => {
              navigate(`/dashboard?tab=bookings&booking=${booking.id}`);
              onOpenChange(false);
            }}
          >
            Open booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
