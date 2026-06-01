import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enGB } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import { BookingEventPopup } from "./BookingEventPopup";

const locales = { "en-GB": enGB };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

export const STATUS_COLOURS: Record<string, string> = {
  enquired:  "#FFA500",
  confirmed: "#1A6B3C",
  briefed:   "#1E3A5F",
  completed: "#6B7280",
  cancelled: "#EF4444",
};

const STATUS_LABELS: Record<string, string> = {
  enquired:  "Enquired",
  confirmed: "Confirmed",
  briefed:   "Briefed",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function BookingCalendar() {
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [popupOpen, setPopupOpen] = useState(false);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["/api/bookings/calendar"],
    queryFn: () => apiRequest("/api/bookings/calendar"),
  });

  const events = (bookings as any[]).map((b) => ({
    id: b.id,
    title: b.freelancerName || "Unnamed",
    start: new Date(b.eventDate ?? b.createdAt),
    end: new Date(b.eventDate ?? b.createdAt),
    allDay: true,
    resource: b,
    status: b.status,
    colour: STATUS_COLOURS[b.status] ?? "#6B7280",
  }));

  const eventStyleGetter = (event: any) => ({
    style: {
      backgroundColor: event.colour,
      borderRadius: "4px",
      border: "none",
      color: "#ffffff",
      fontSize: "12px",
      padding: "2px 6px",
      cursor: "pointer",
    },
  });

  const handleSelectEvent = (event: any) => {
    setSelectedBooking(event.resource);
    setPopupOpen(true);
  };

  return (
    <div className="h-[700px] p-4">
      {/* Colour legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {Object.entries(STATUS_COLOURS).map(([status, colour]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: colour }} />
            <span className="text-xs text-muted-foreground">{STATUS_LABELS[status]}</span>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Calendar
          localizer={localizer}
          events={events}
          defaultView={Views.MONTH}
          views={[Views.MONTH, Views.WEEK, Views.AGENDA]}
          style={{ height: "100%" }}
          eventPropGetter={eventStyleGetter}
          onSelectEvent={handleSelectEvent}
          culture="en-GB"
          formats={{
            monthHeaderFormat: (date: Date) => format(date, "MMMM yyyy"),
            dayHeaderFormat: (date: Date) => format(date, "EEE d MMM"),
            agendaDateFormat: (date: Date) => format(date, "EEE d MMM yyyy"),
          }}
          popup
          tooltipAccessor={(event: any) => `${event.title} — ${event.status}`}
        />
      )}

      {selectedBooking && (
        <BookingEventPopup
          booking={selectedBooking}
          open={popupOpen}
          onOpenChange={(open) => {
            setPopupOpen(open);
            if (!open) setSelectedBooking(null);
          }}
        />
      )}
    </div>
  );
}
