import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enGB } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import CalendarSyncPanel from "./CalendarSyncPanel";
import { CalendarEventWrapper } from "./CalendarEventWrapper";
import { CreateEventModal } from "./CreateEventModal";
import { EventDetailPanel } from "./EventDetailPanel";
import { CancelBookingConfirmModal } from "./CancelBookingConfirmModal";

const locales = { "en-GB": enGB };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

export const STATUS_COLOURS: Record<string, string> = {
  enquired:  "#FFA500",
  confirmed: "#1A6B3C",
  briefed:   "#1E3A5F",
  completed: "#6B7280",
  cancelled: "#EF4444",
};

const JOB_COLOUR = "#E8610A"; // EventLink orange for job events

const STATUS_LABELS: Record<string, string> = {
  enquired:  "Enquired (booking)",
  confirmed: "Confirmed (booking)",
  briefed:   "Briefed (booking)",
  completed: "Completed (booking)",
  cancelled: "Cancelled (booking)",
};

export function BookingCalendar() {
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createDate, setCreateDate] = useState<Date | null>(null);
  const [cancelBooking, setCancelBooking] = useState<any>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const { data: calendarData = [], isLoading } = useQuery({
    queryKey: ["/api/bookings/calendar"],
    queryFn: () => apiRequest("/api/bookings/calendar"),
  });

  // Listen for context menu custom events
  useEffect(() => {
    const handleOpenDetail = (e: CustomEvent) => {
      setSelectedEvent(e.detail);
      setDetailOpen(true);
    };
    const handleCancelBooking = (e: CustomEvent) => {
      setCancelBooking(e.detail);
      setCancelOpen(true);
    };
    window.addEventListener("calendar:open-detail", handleOpenDetail as EventListener);
    window.addEventListener("calendar:cancel-booking", handleCancelBooking as EventListener);
    return () => {
      window.removeEventListener("calendar:open-detail", handleOpenDetail as EventListener);
      window.removeEventListener("calendar:cancel-booking", handleCancelBooking as EventListener);
    };
  }, []);

  const events = (calendarData as any[]).map((item) => {
    if (item.calendarType === "job") {
      const dateStr = item.eventDate || item.event_date;
      return {
        id: `job-${item.id}`,
        title: item.title || "Untitled Job",
        start: new Date(dateStr),
        end: new Date(dateStr),
        allDay: true,
        resource: item,
        calendarType: "job",
        colour: JOB_COLOUR,
      };
    }
    // booking
    return {
      id: `booking-${item.id}`,
      title: item.freelancerName || "Unnamed",
      start: new Date(item.eventDate ?? item.createdAt),
      end: new Date(item.eventDate ?? item.createdAt),
      allDay: true,
      resource: item,
      calendarType: "booking",
      status: item.status,
      colour: STATUS_COLOURS[item.status] ?? "#6B7280",
    };
  });

  const eventStyleGetter = (event: any) => ({
    style: {
      backgroundColor: event.colour,
      borderRadius: "4px",
      border: event.calendarType === "job" ? "2px dashed rgba(255,255,255,0.5)" : "none",
      color: "#ffffff",
      fontSize: "12px",
      padding: "2px 6px",
      cursor: "pointer",
      opacity: event.status === "cancelled" ? 0.5 : 1,
    },
  });

  const handleSelectEvent = (event: any) => {
    setSelectedEvent(event.resource);
    setDetailOpen(true);
  };

  const handleDoubleClickEvent = (event: any) => {
    setSelectedEvent(event.resource);
    setDetailOpen(true);
  };

  const handleSelectSlot = ({ start }: { start: Date }) => {
    setCreateDate(start);
    setCreateModalOpen(true);
  };

  const components = {
    event: (props: any) => (
      <CalendarEventWrapper event={{ ...props.event, resource: props.event.resource }} />
    ),
  };

  return (
    <div className="p-4">
      <CalendarSyncPanel />
      <div className="h-[700px]">
        {/* Colour legend */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-1.5">
            <div
              className="h-3 w-3 rounded-sm border border-white/30"
              style={{ backgroundColor: JOB_COLOUR, border: "2px dashed rgba(0,0,0,0.2)" }}
            />
            <span className="text-xs text-muted-foreground">Job Event</span>
          </div>
          {Object.entries(STATUS_COLOURS).map(([status, colour]) => (
            <div key={status} className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: colour }} />
              <span className="text-xs text-muted-foreground">{STATUS_LABELS[status]}</span>
            </div>
          ))}
          <span className="ml-auto text-xs text-muted-foreground hidden sm:block">
            Click empty day to add • Click event for details • Right-click for options
          </span>
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
            onDoubleClickEvent={handleDoubleClickEvent}
            onSelectSlot={handleSelectSlot}
            selectable
            components={components}
            culture="en-GB"
            formats={{
              monthHeaderFormat: (date: Date) => format(date, "MMMM yyyy"),
              dayHeaderFormat: (date: Date) => format(date, "EEE d MMM"),
              agendaDateFormat: (date: Date) => format(date, "EEE d MMM yyyy"),
            }}
            popup
            tooltipAccessor={(event: any) =>
              event.calendarType === "job"
                ? `Job: ${event.title}`
                : `${event.title} — ${event.status}`
            }
          />
        )}
      </div>

      <CreateEventModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        initialDate={createDate}
      />

      <EventDetailPanel
        event={selectedEvent}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setSelectedEvent(null);
        }}
      />

      <CancelBookingConfirmModal
        open={cancelOpen}
        onOpenChange={(open) => {
          setCancelOpen(open);
          if (!open) setCancelBooking(null);
        }}
        booking={cancelBooking}
      />
    </div>
  );
}
