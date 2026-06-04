import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Briefcase,
  ExternalLink,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { CancelBookingConfirmModal } from "./CancelBookingConfirmModal";
import { useState } from "react";

interface Props {
  event: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_COLOURS: Record<string, string> = {
  enquired: "bg-orange-100 text-orange-700 border-orange-200",
  confirmed: "bg-green-100 text-green-700 border-green-200",
  briefed: "bg-blue-100 text-blue-700 border-blue-200",
  completed: "bg-gray-100 text-gray-600 border-gray-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
  active: "bg-green-100 text-green-700 border-green-200",
  closed: "bg-gray-100 text-gray-600 border-gray-200",
  paused: "bg-yellow-100 text-yellow-700 border-yellow-200",
};

export function EventDetailPanel({ event, open, onOpenChange }: Props) {
  const [, setLocation] = useLocation();
  const [cancelOpen, setCancelOpen] = useState(false);

  if (!event) return null;

  const isJob = event.calendarType === "job";

  const date = event.eventDate || event.event_date;
  const formattedDate = date ? format(new Date(date), "EEEE, d MMMM yyyy") : null;

  if (isJob) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              Job Event
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-5">
            <div>
              <h3 className="font-semibold text-lg leading-tight">{event.title}</h3>
              {event.company_name && (
                <p className="text-sm text-muted-foreground mt-0.5">{event.company_name}</p>
              )}
            </div>

            <Badge
              className={`text-xs border ${STATUS_COLOURS[event.status] ?? "bg-gray-100 text-gray-600"}`}
              variant="outline"
            >
              {(event.status ?? "unknown").charAt(0).toUpperCase() + (event.status ?? "").slice(1)}
            </Badge>

            <Separator />

            <div className="space-y-3 text-sm">
              {formattedDate && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4 flex-shrink-0" />
                  <span>{formattedDate}</span>
                </div>
              )}
              {event.location && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 flex-shrink-0" />
                  <span>{event.location}</span>
                </div>
              )}
              {event.rate && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-medium">Rate:</span>
                  <span>{event.rate}</span>
                </div>
              )}
            </div>

            <Separator />

            <div className="flex flex-col gap-2">
              <Button
                variant="default"
                size="sm"
                className="w-full"
                onClick={() => {
                  setLocation(`/employer?tab=jobs`);
                  onOpenChange(false);
                }}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Go to My Jobs
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Booking Details
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-5">
            <div>
              <h3 className="font-semibold text-lg">{event.freelancerName || "Unnamed Freelancer"}</h3>
              {event.freelancerTitle && (
                <p className="text-sm text-muted-foreground">{event.freelancerTitle}</p>
              )}
            </div>

            <Badge
              className={`text-xs border ${STATUS_COLOURS[event.status] ?? "bg-gray-100 text-gray-600"}`}
              variant="outline"
            >
              {(event.status ?? "unknown").charAt(0).toUpperCase() + (event.status ?? "").slice(1)}
            </Badge>

            <Separator />

            <div className="space-y-3 text-sm">
              {formattedDate && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4 flex-shrink-0" />
                  <span>{formattedDate}</span>
                </div>
              )}
              {event.callTime && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 flex-shrink-0" />
                  <span>Call time: {event.callTime}</span>
                </div>
              )}
              {event.venueAddress && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 flex-shrink-0" />
                  <span>{event.venueAddress}</span>
                </div>
              )}
              {event.agreedRate && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-medium">Rate:</span>
                  <span>{event.agreedRate}</span>
                </div>
              )}
            </div>

            {event.employerNotes && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{event.employerNotes}</p>
                </div>
              </>
            )}

            <Separator />

            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setLocation("/employer?tab=bookings");
                  onOpenChange(false);
                }}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Go to Bookings
              </Button>
              {event.status !== "cancelled" && event.status !== "completed" && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    onOpenChange(false);
                    setCancelOpen(true);
                  }}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1.5" />
                  Cancel Booking
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <CancelBookingConfirmModal
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        booking={event}
      />
    </>
  );
}
