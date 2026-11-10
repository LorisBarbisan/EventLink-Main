import { useState, useEffect, useMemo } from "react";
import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enGB } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertCircle,
  CalendarCheck,
  CalendarX,
  Loader2,
  Receipt,
  RefreshCw,
  Unplug,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { type GigForm, EMPTY_GIG_FORM, GigFormBody } from "./GigFormFields";

// ── react-big-calendar setup ──────────────────────────────────────────────────

const locales = { "en-GB": enGB };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

// ── Colours ───────────────────────────────────────────────────────────────────

const BOOKING_COLOURS: Record<string, string> = {
  enquired: "#FFA500",
  confirmed: "#1A6B3C",
  briefed: "#1E3A5F",
  completed: "#6B7280",
  cancelled: "#EF4444",
};

const BOOKING_LABELS: Record<string, string> = {
  enquired: "Enquired",
  confirmed: "Confirmed",
  briefed: "Applied",
  completed: "Completed",
  cancelled: "Cancelled",
};

const AVAIL_COLOURS: Record<string, string> = {
  available: "#16a34a",
  tentative: "#d97706",
  unavailable: "#dc2626",
};

const AVAIL_LABELS: Record<string, string> = {
  available: "Available",
  tentative: "Tentative",
  unavailable: "Unavailable",
};

const GIG_COLOUR = "#0369a1"; // sky-700

const GIG_STATUS_LABELS: Record<string, string> = {
  pencilled: "Pencilled",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

// ── Types ────────────────────────────────────────────────────────────────────

interface GigEntry {
  id: number;
  description: string | null;
  work_date: string;
  work_end_date?: string | null;
  work_status: "pencilled" | "confirmed" | "completed" | "cancelled";
  call_time?: string | null;
  venue_address?: string | null;
  gross_amount_pence: number;
  currency: string;
  client_name?: string | null;
  unit?: string | null;
  quantity?: string | null;
  status?: string;
  paid_date?: string | null;
  notes?: string | null;
}

interface CalendarStatus {
  connected: boolean;
  provider?: "google" | "outlook";
  status?: "active" | "needs_reconnect" | "error";
  last_error?: string | null;
  last_read_sync_at?: string | null;
  last_write_sync_at?: string | null;
  push_bookings?: boolean;
  push_availability?: boolean;
  read_external?: boolean;
}

interface AvailabilityEntry {
  id: number;
  date: string;
  status: "available" | "tentative" | "unavailable";
  note?: string | null;
}

interface FreelancerBooking {
  booking: {
    id: number;
    status: string;
    jobId: number;
    agreedRate?: string | null;
  };
  job: {
    id: number;
    title: string;
    location?: string | null;
    eventDate?: string | null;
    endDate?: string | null;
  };
  employer: {
    id: number;
    firstName?: string | null;
    lastName?: string | null;
    companyName?: string | null;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Sync panel ────────────────────────────────────────────────────────────────

function CalendarSyncPanel({
  status,
  syncing,
  onSync,
  onConnect,
}: {
  status: CalendarStatus | undefined;
  syncing: boolean;
  onSync: () => void;
  onConnect: (p: "google" | "outlook") => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const prefMut = useMutation({
    mutationFn: (patch: { read_external?: boolean }) =>
      apiRequest("/api/calendar/preferences", { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/calendar/status"] }),
    onError: () => toast({ title: "Failed to save preference", variant: "destructive" }),
  });

  const disconnectMut = useMutation({
    mutationFn: () => apiRequest("/api/calendar/disconnect", { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/status"] });
      toast({ title: "Calendar disconnected" });
    },
    onError: () => toast({ title: "Disconnect failed", variant: "destructive" }),
  });

  const providerLabel = status?.provider === "google" ? "Google Calendar" : "Outlook Calendar";
  const needsReconnect = status?.status === "needs_reconnect" || status?.status === "error";

  return (
    <div className="mb-4 rounded-xl border bg-card p-4">
      {status?.connected ? (
        <div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${needsReconnect ? "bg-amber-100 dark:bg-amber-900/30" : "bg-emerald-100 dark:bg-emerald-900/30"}`}
              >
                {needsReconnect ? (
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                ) : (
                  <CalendarCheck className="h-4 w-4 text-emerald-600" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Connected to {providerLabel}</span>
                  <Badge
                    className={
                      needsReconnect
                        ? "border-0 bg-amber-100 text-amber-700"
                        : "border-0 bg-emerald-100 text-emerald-700"
                    }
                  >
                    {needsReconnect ? "Needs reconnect" : "Active"}
                  </Badge>
                </div>
                {status.last_read_sync_at && (
                  <p className="text-xs text-muted-foreground">
                    Last sync: {fmtDateTime(status.last_read_sync_at)}
                  </p>
                )}
                {needsReconnect && status.last_error && (
                  <p className="text-xs text-amber-600">{status.last_error}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {needsReconnect ? (
                <Button size="sm" variant="outline" onClick={() => onConnect(status.provider!)}>
                  Reconnect
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={onSync}
                  disabled={syncing}
                  className="gap-2 bg-orange-500 text-white hover:bg-orange-600"
                >
                  <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Syncing…" : "Sync now"}
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive">
                    <Unplug className="h-3 w-3" />
                    Disconnect
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disconnect calendar?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes the calendar connection. Existing events created by EventLink
                      will not be deleted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => disconnectMut.mutate()}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Disconnect
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
          {status.provider === "google" && (
            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <div>
                <p className="text-sm font-medium">Show Google Calendar events</p>
                <p className="text-xs text-muted-foreground">
                  Display your personal Google Calendar events on this calendar view.
                </p>
              </div>
              <button
                role="switch"
                aria-checked={!!status.read_external}
                onClick={() => prefMut.mutate({ read_external: !status.read_external })}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${status.read_external ? "bg-primary" : "bg-input"}`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${status.read_external ? "translate-x-4" : "translate-x-0"}`}
                />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <CalendarX className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">Sync bookings to your calendar</p>
              <p className="text-xs text-muted-foreground">
                Connect Google Calendar or Outlook to keep your schedule in sync.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => onConnect("google")}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Connect Google Calendar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => onConnect("outlook")}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.58.52-.37.2-.87.2t-.85-.2q-.35-.21-.57-.55-.22-.33-.33-.75-.1-.42-.1-.86t.1-.87q.1-.43.34-.76.22-.34.59-.54.36-.2.87-.2t.86.2q.35.21.57.55.22.34.31.77.1.43.1.88zM24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h6.5V2.55q0-.44.3-.75.3-.3.75-.3h12.9q.44 0 .75.3.3.3.3.75V10.85l1.24.72q.26.14.26.43zm-10.24-5.47l-3.76 2.5 3.76 2.5 3.76-2.5zm-6 2.09l3.75 2.5v5.5h.5v-5.5l3.75-2.5V18h-8V8.62zM22.5 11.47l-2.26-1.3v8.33h2.26z"
                  fill="#0078D4"
                />
              </svg>
              Connect Outlook Calendar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Availability dialog ───────────────────────────────────────────────────────

function AvailabilityDialog({
  date,
  existing,
  onSave,
  onDelete,
  onClose,
}: {
  date: Date;
  existing?: AvailabilityEntry;
  onSave: (date: string, status: string, note: string) => void;
  onDelete: (date: string) => void;
  onClose: () => void;
}) {
  const dateStr = isoDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"availability" | "gig">("availability");
  const [eventTitle, setEventTitle] = useState(existing?.note ?? "");
  const [status, setStatus] = useState<string>(existing?.status ?? "unavailable");
  const [gigForm, setGigForm] = useState<GigForm>({
    ...EMPTY_GIG_FORM,
    work_date: dateStr,
    work_status: "confirmed",
  });

  const { data: clients = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ["/api/earnings/clients"],
  });

  const gigMut = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest("/api/earnings", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/earnings/gigs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings/summary"] });
      toast({ title: "Gig added to your calendar" });
      onClose();
    },
    onError: (e: Error) =>
      toast({ title: "Failed to save gig", description: e.message, variant: "destructive" }),
  });

  const setGig = (k: keyof GigForm, v: string) => setGigForm((f) => ({ ...f, [k]: v }));

  const handleSaveGig = () => {
    if (!gigForm.description.trim() || !gigForm.work_date) return;
    gigMut.mutate({
      description: gigForm.description.trim(),
      client_name: gigForm.client_name.trim() || null,
      work_date: gigForm.work_date,
      work_end_date: gigForm.work_end_date || null,
      unit: gigForm.unit,
      quantity: parseFloat(gigForm.quantity) || 1,
      gross_amount: parseFloat(gigForm.gross_amount) || 0,
      currency: gigForm.currency,
      status: gigForm.status,
      paid_date: gigForm.status === "paid" ? gigForm.paid_date || gigForm.work_date : null,
      notes: gigForm.notes || null,
      work_status: gigForm.work_status || null,
      call_time: gigForm.call_time || null,
      venue_address: gigForm.venue_address || null,
    });
  };

  const isExternalBooking = status === "unavailable" && eventTitle.trim().length > 0;

  const dateLabel = date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{dateLabel}</DialogTitle>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="flex gap-1 rounded-md border p-1">
          <button
            className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors ${mode === "availability" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setMode("availability")}
          >
            Set availability
          </button>
          <button
            className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors ${mode === "gig" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setMode("gig")}
          >
            Log a gig
          </button>
        </div>

        {mode === "availability" ? (
          <>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="event-title">Event name (optional)</Label>
                <input
                  id="event-title"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="e.g. Wedding gig, Commercial shoot…"
                />
                <p className="text-[11px] text-muted-foreground">
                  Add a name to log an external booking. Leave blank to just mark your availability.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="avail-status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="avail-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">✅ Available</SelectItem>
                    <SelectItem value="tentative">⚠️ Tentative</SelectItem>
                    <SelectItem value="unavailable">❌ Unavailable / Booked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isExternalBooking && (
                <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                  This will appear as a booking on your calendar and block this day.
                </p>
              )}
            </div>
            <DialogFooter className="flex-row gap-2">
              {existing && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mr-auto text-muted-foreground"
                  onClick={() => onDelete(dateStr)}
                >
                  Remove
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => onSave(dateStr, status, eventTitle)}>
                Save
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="py-2">
              <GigFormBody form={gigForm} onChange={setGig} clients={clients} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveGig}
                disabled={gigMut.isPending || !gigForm.description.trim() || !gigForm.work_date}
              >
                {gigMut.isPending ? "Saving…" : "Add gig"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Booking detail dialog ─────────────────────────────────────────────────────

import { type HiredBookingForCalendar } from "./BooksTab";

function BookingDetailDialog({
  booking,
  onClose,
  onInvoice,
  hasInvoice,
}: {
  booking: FreelancerBooking;
  onClose: () => void;
  onInvoice?: (b: HiredBookingForCalendar) => void;
  hasInvoice?: boolean;
}) {
  const statusColour = BOOKING_COLOURS[booking.booking.status] ?? "#6B7280";
  const employerName =
    [booking.employer.firstName, booking.employer.lastName].filter(Boolean).join(" ") ||
    booking.employer.companyName ||
    "Employer";

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: statusColour }}
            />
            {booking.job.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <span className="text-muted-foreground">Status</span>
            <span className="font-medium capitalize" style={{ color: statusColour }}>
              {BOOKING_LABELS[booking.booking.status] ?? booking.booking.status}
            </span>
            <span className="text-muted-foreground">Client</span>
            <span className="font-medium">{employerName}</span>
            {booking.employer.companyName && (
              <>
                <span className="text-muted-foreground">Company</span>
                <span>{booking.employer.companyName}</span>
              </>
            )}
            {booking.job.location && (
              <>
                <span className="text-muted-foreground">Location</span>
                <span>{booking.job.location}</span>
              </>
            )}
            {booking.job.eventDate && (
              <>
                <span className="text-muted-foreground">Event date</span>
                <span>
                  {new Date(booking.job.eventDate).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </>
            )}
            {booking.booking.agreedRate && (
              <>
                <span className="text-muted-foreground">Rate</span>
                <span>{booking.booking.agreedRate}</span>
              </>
            )}
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {onInvoice && (
            <Button
              size="sm"
              onClick={() => {
                onInvoice({
                  bookingId: booking.booking.id,
                  jobId: booking.booking.jobId,
                  jobTitle: booking.job.title,
                  agreedRate: booking.booking.agreedRate ?? null,
                  employerName,
                  companyName: booking.employer.companyName ?? null,
                });
                onClose();
              }}
            >
              <Receipt className="mr-1.5 h-3.5 w-3.5" />
              {hasInvoice ? "View / Edit invoice" : "Create invoice"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Gig edit dialog (calendar click on a gig event) ──────────────────────────

function GigEditDialog({
  gig,
  clients,
  onClose,
}: {
  gig: GigEntry;
  clients: Array<{ id: number; name: string }>;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<GigForm>({
    description: gig.description ?? "",
    client_name: gig.client_name ?? "",
    work_date: gig.work_date.slice(0, 10),
    work_end_date: gig.work_end_date?.slice(0, 10) ?? "",
    unit: (gig.unit as GigForm["unit"]) ?? "day",
    quantity: String(gig.quantity ?? 1),
    gross_amount: gig.gross_amount_pence > 0 ? (gig.gross_amount_pence / 100).toFixed(2) : "",
    currency: gig.currency ?? "GBP",
    status: (gig.status as GigForm["status"]) ?? "expected",
    paid_date: gig.paid_date?.slice(0, 10) ?? "",
    notes: gig.notes ?? "",
    work_status: (gig.work_status as GigForm["work_status"]) ?? "",
    call_time: gig.call_time ?? "",
    venue_address: gig.venue_address ?? "",
  });

  const set = (k: keyof GigForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const patchMut = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest(`/api/earnings/${gig.id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/earnings/gigs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings/summary"] });
      toast({ title: "Gig updated" });
      onClose();
    },
    onError: (e: Error) =>
      toast({ title: "Failed to save", description: e.message, variant: "destructive" }),
  });

  const handleSave = () => {
    if (!form.description.trim() || !form.work_date) return;
    patchMut.mutate({
      description: form.description.trim(),
      client_name: form.client_name.trim() || null,
      work_date: form.work_date,
      work_end_date: form.work_end_date || null,
      unit: form.unit,
      quantity: parseFloat(form.quantity) || 1,
      gross_amount: parseFloat(form.gross_amount) || 0,
      currency: form.currency,
      status: form.status,
      paid_date: form.status === "paid" ? form.paid_date || form.work_date : null,
      notes: form.notes || null,
      work_status: form.work_status || null,
      call_time: form.call_time || null,
      venue_address: form.venue_address || null,
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit gig</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <GigFormBody form={form} onChange={set} clients={clients} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={patchMut.isPending || !form.description.trim() || !form.work_date}
          >
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function CalendarTab({
  onInvoice,
}: {
  onInvoice?: (b: HiredBookingForCalendar) => void;
} = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [availDialog, setAvailDialog] = useState<Date | null>(null);
  const [bookingDialog, setBookingDialog] = useState<FreelancerBooking | null>(null);
  const [gigDialog, setGigDialog] = useState<GigEntry | null>(null);
  const [calDate, setCalDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<string>(Views.MONTH);

  const { data: invoiceLinks = [] } = useQuery<
    { id: number; job_id: number | null; booking_id: number | null }[]
  >({
    queryKey: ["/api/invoices", "ids"],
    queryFn: () => apiRequest("/api/invoices"),
    enabled: !!user,
    select: (data: any[]) =>
      data.map((inv) => ({ id: inv.id, job_id: inv.job_id, booking_id: inv.booking_id })),
  });

  const hasInvoiceForBooking = (b: FreelancerBooking) =>
    invoiceLinks.some(
      (inv) =>
        (b.booking.jobId && inv.job_id === b.booking.jobId) ||
        (b.booking.id && inv.booking_id === b.booking.id)
    );

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: calStatus } = useQuery<CalendarStatus>({
    queryKey: ["/api/calendar/status"],
    queryFn: async () => {
      const data = await apiRequest("/api/calendar/status");
      // API returns { connected, connection: { provider, status, ... } } — flatten
      return { connected: data.connected, ...(data.connection ?? {}) } as CalendarStatus;
    },
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const { data: bookingsData = [], isLoading } = useQuery<FreelancerBooking[]>({
    queryKey: ["/api/bookings/freelancer"],
    queryFn: () => apiRequest("/api/bookings/freelancer"),
    enabled: !!user,
  });

  // Also fetch from the application-based bookings endpoint (older jobs system)
  const { data: rawBookings = [] } = useQuery<
    {
      id: number;
      job_id?: number;
      job_title: string;
      company_name?: string;
      event_date?: string;
      end_date?: string;
      rate?: string;
      location?: string;
      status?: string;
    }[]
  >({
    queryKey: ["/api/freelancer", user?.id, "bookings"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/freelancer/${user!.id}/bookings`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user?.id,
  });

  // Convert old-system bookings to FreelancerBooking shape, skip any already in bookingsData
  const fmsJobIds = new Set(bookingsData.map((b) => b.job.id));
  const legacyBookings: FreelancerBooking[] = rawBookings
    .filter((b) => !fmsJobIds.has(b.job_id ?? -1))
    .map((b) => ({
      booking: {
        id: b.id,
        status: b.status === "hired" ? "confirmed" : (b.status ?? "confirmed"),
        jobId: b.job_id ?? 0,
        agreedRate: b.rate ?? null,
      },
      job: {
        id: b.job_id ?? 0,
        title: b.job_title,
        location: b.location ?? null,
        eventDate: b.event_date ?? null,
        endDate: b.end_date ?? null,
      },
      employer: { id: 0, firstName: null, lastName: null, companyName: b.company_name ?? null },
    }));

  const allBookingsData = [...bookingsData, ...legacyBookings];

  // Availability: load a wide range (±3 months) using proper Date arithmetic so month overflow is handled
  const now = new Date();
  const rangeStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const rangeEndDate = new Date(now.getFullYear(), now.getMonth() + 4, 0); // day 0 = last day of previous month
  const rangeStart = rangeStartDate.toISOString().slice(0, 10);
  const rangeEnd = rangeEndDate.toISOString().slice(0, 10);

  const { data: availData = [] } = useQuery<AvailabilityEntry[]>({
    queryKey: ["/api/calendar/availability", rangeStart, rangeEnd],
    queryFn: () => apiRequest(`/api/calendar/availability?from=${rangeStart}&to=${rangeEnd}`),
    enabled: !!user,
  });

  const { data: externalEvents = [] } = useQuery<
    { id: string; title: string; start: string; end: string; allDay: boolean }[]
  >({
    queryKey: ["/api/calendar/external-events", rangeStart, rangeEnd],
    queryFn: () => apiRequest(`/api/calendar/external-events?from=${rangeStart}&to=${rangeEnd}`),
    enabled: !!user && !!calStatus?.read_external,
    staleTime: 5 * 60_000,
  });

  const { data: gigEntries = [] } = useQuery<GigEntry[]>({
    queryKey: ["/api/earnings/gigs", rangeStart, rangeEnd],
    queryFn: () => apiRequest(`/api/earnings/gigs?from=${rangeStart}&to=${rangeEnd}`),
    enabled: !!user,
  });

  const { data: gigClients = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ["/api/earnings/clients"],
    enabled: !!user,
  });

  // Handle OAuth callback success/error params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const calSuccess = params.get("calSuccess");
    const calError = params.get("calError");
    if (calSuccess) {
      toast({ title: `${calSuccess === "google" ? "Google" : "Outlook"} Calendar connected!` });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/status"] });
    } else if (calError) {
      toast({
        title: "Calendar connection failed",
        description:
          calError === "invalid_state"
            ? "Session expired, please try again."
            : "Could not connect calendar.",
        variant: "destructive",
      });
    }
    if (calSuccess || calError) {
      const url = new URL(window.location.href);
      url.searchParams.delete("calSuccess");
      url.searchParams.delete("calError");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const syncMut = useMutation({
    mutationFn: () => apiRequest("/api/calendar/sync", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/status"] });
      toast({ title: "Sync triggered", description: "Your calendar will update shortly." });
    },
    onError: () => toast({ title: "Sync failed", variant: "destructive" }),
  });

  const setAvailMut = useMutation({
    mutationFn: ({ date, status, note }: { date: string; status: string; note: string }) =>
      apiRequest("/api/calendar/availability", {
        method: "PUT",
        body: JSON.stringify({ date, status, note: note || null }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/calendar/availability", rangeStart, rangeEnd],
      });
      setAvailDialog(null);
      toast({ title: "Availability saved" });
    },
    onError: () => toast({ title: "Failed to save availability", variant: "destructive" }),
  });

  const deleteAvailMut = useMutation({
    mutationFn: (date: string) =>
      apiRequest(`/api/calendar/availability/${date}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/calendar/availability", rangeStart, rangeEnd],
      });
      setAvailDialog(null);
      toast({ title: "Availability cleared" });
    },
    onError: () => toast({ title: "Failed to clear", variant: "destructive" }),
  });

  // ── Calendar connect handler ───────────────────────────────────────────────

  function handleConnect(provider: "google" | "outlook") {
    const token = localStorage.getItem("auth_token") ?? "";
    window.location.href = `/api/calendar/${provider}/connect?token=${encodeURIComponent(token)}`;
  }

  // ── Availability day-tint (dayPropGetter) ─────────────────────────────────

  const availByDate = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of availData) map[a.date] = a.status;
    return map;
  }, [availData]);

  const AVAIL_TINTS: Record<string, string> = {
    available: "rgba(22, 163, 74, 0.18)",
    tentative: "rgba(217, 119, 6, 0.18)",
    unavailable: "rgba(220, 38, 38, 0.18)",
  };

  const dayPropGetter = (date: Date) => {
    const key = isoDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
    const status = availByDate[key];
    if (!status) return {};
    return { style: { backgroundColor: AVAIL_TINTS[status] } };
  };

  // ── Build events ───────────────────────────────────────────────────────────

  const bookingEvents = allBookingsData.map((b) => {
    // Use eventDate if available; undated bookings pin to current calendar view date
    const startDate = b.job.eventDate ? new Date(b.job.eventDate) : calDate;
    const endDate = b.job.endDate ? new Date(b.job.endDate) : startDate;
    return {
      id: `booking-${b.booking.id}`,
      title: b.job.title,
      start: startDate,
      end: endDate,
      allDay: true,
      resource: b,
      colour: BOOKING_COLOURS[b.booking.status] ?? "#6B7280",
      status: b.booking.status,
    };
  });

  const availEvents = availData.map((a) => ({
    id: `avail-${a.id}`,
    title: AVAIL_LABELS[a.status] + (a.note ? ` · ${a.note}` : ""),
    start: new Date(`${a.date}T12:00:00`),
    end: new Date(`${a.date}T12:00:00`),
    allDay: true,
    resource: a,
    colour: AVAIL_COLOURS[a.status],
    isAvailability: true,
    availStatus: a.status,
  }));

  const externalCalEvents = (calStatus?.read_external ? externalEvents : []).map((e) => ({
    id: `ext-${e.id}`,
    title: `📅 ${e.title}`,
    start: new Date(e.start),
    end: new Date(e.end),
    allDay: e.allDay,
    colour: "#7C3AED",
    isExternal: true,
  }));

  const gigEvents = gigEntries.map((g) => {
    const startDate = new Date(`${g.work_date}T12:00:00`);
    const endDate = g.work_end_date ? new Date(`${g.work_end_date}T12:00:00`) : startDate;
    const statusLabel = GIG_STATUS_LABELS[g.work_status] ?? g.work_status;
    const opacity = g.work_status === "cancelled" ? 0.4 : g.work_status === "pencilled" ? 0.7 : 1;
    return {
      id: `gig-${g.id}`,
      title: `🎯 ${g.description ?? "Gig"} · ${statusLabel}`,
      start: startDate,
      end: endDate,
      allDay: true,
      resource: g,
      colour: GIG_COLOUR,
      isGig: true,
      gigOpacity: opacity,
    };
  });

  // Availability shown as day-background tint in grid views; show as entries only in agenda
  const events = [
    ...bookingEvents,
    ...(currentView === Views.AGENDA ? availEvents : []),
    ...externalCalEvents,
    ...gigEvents,
  ];

  const eventStyleGetter = (event: any) => ({
    style: {
      backgroundColor: event.colour,
      borderRadius: "4px",
      border: event.isAvailability
        ? "1px dashed rgba(255,255,255,0.6)"
        : event.isExternal
          ? "1px solid rgba(124,58,237,0.4)"
          : event.isGig
            ? "1px solid rgba(3,105,161,0.4)"
            : "none",
      color: "#ffffff",
      fontSize: "11px",
      padding: "1px 5px",
      cursor: event.isExternal ? "default" : "pointer",
      opacity:
        event.status === "cancelled" ? 0.5 : event.isExternal ? 0.75 : (event.gigOpacity ?? 1),
    },
  });

  const handleSelectEvent = (event: any) => {
    if (event.isExternal) return;
    if (event.isGig) {
      setGigDialog(event.resource as GigEntry);
    } else if (event.isAvailability) {
      const dateObj = new Date(event.resource.date + "T12:00:00");
      setAvailDialog(dateObj);
    } else {
      setBookingDialog(event.resource as FreelancerBooking);
    }
  };

  const handleSelectSlot = ({ start }: { start: Date }) => {
    setAvailDialog(start);
  };

  const selectedAvail = availDialog
    ? availData.find(
        (a) =>
          a.date ===
          isoDate(availDialog.getFullYear(), availDialog.getMonth() + 1, availDialog.getDate())
      )
    : undefined;

  return (
    <div>
      {/* Sync panel */}
      <CalendarSyncPanel
        status={calStatus}
        syncing={syncMut.isPending}
        onSync={() => syncMut.mutate()}
        onConnect={handleConnect}
      />

      {/* Legend */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {Object.entries(BOOKING_COLOURS).map(([status, colour]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: colour }} />
            <span className="text-xs text-muted-foreground">{BOOKING_LABELS[status]}</span>
          </div>
        ))}
        <div className="mx-1 h-3 w-px bg-border" />
        {Object.entries(AVAIL_COLOURS).map(([status, colour]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div
              className="h-3 w-5 rounded-sm"
              style={{ backgroundColor: AVAIL_TINTS[status], border: `1.5px solid ${colour}` }}
            />
            <span className="text-xs text-muted-foreground">{AVAIL_LABELS[status]}</span>
          </div>
        ))}
        {calStatus?.read_external && (
          <>
            <div className="mx-1 h-3 w-px bg-border" />
            <div className="flex items-center gap-1.5">
              <div
                className="h-3 w-3 rounded-full opacity-75"
                style={{ backgroundColor: "#7C3AED" }}
              />
              <span className="text-xs text-muted-foreground">Google Calendar</span>
            </div>
          </>
        )}
        <div className="mx-1 h-3 w-px bg-border" />
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: GIG_COLOUR }} />
          <span className="text-xs text-muted-foreground">My gigs</span>
        </div>
        <span className="ml-auto hidden text-xs text-muted-foreground sm:block">
          Click a booking to view details • Click an empty day to log availability or a gig
        </span>
      </div>

      {/* Calendar */}
      <div className="h-[680px]">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Calendar
            localizer={localizer}
            events={events}
            date={calDate}
            onNavigate={(date) => setCalDate(date)}
            defaultView={Views.MONTH}
            views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
            view={currentView as any}
            onView={(view) => {
              setCurrentView(view);
              if (view === Views.AGENDA) setCalDate(new Date());
            }}
            length={730}
            style={{ height: "100%" }}
            eventPropGetter={eventStyleGetter}
            dayPropGetter={dayPropGetter}
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
            selectable
            culture="en-GB"
            formats={{
              monthHeaderFormat: (date: Date) => format(date, "MMMM yyyy"),
              dayHeaderFormat: (date: Date) => format(date, "EEE d MMM"),
              agendaDateFormat: (date: Date) => format(date, "EEE d MMM yyyy"),
            }}
            popup
            tooltipAccessor={(event: any) =>
              event.isAvailability
                ? `${AVAIL_LABELS[event.availStatus]}${event.resource?.note ? ` · ${event.resource.note}` : ""}`
                : `${event.title} — ${BOOKING_LABELS[event.status] ?? event.status}`
            }
          />
        )}
      </div>

      {availDialog && (
        <AvailabilityDialog
          date={availDialog}
          existing={selectedAvail}
          onSave={(date, status, note) => setAvailMut.mutate({ date, status, note })}
          onDelete={(date) => deleteAvailMut.mutate(date)}
          onClose={() => setAvailDialog(null)}
        />
      )}

      {bookingDialog && (
        <BookingDetailDialog
          booking={bookingDialog}
          onClose={() => setBookingDialog(null)}
          onInvoice={onInvoice}
          hasInvoice={hasInvoiceForBooking(bookingDialog)}
        />
      )}

      {gigDialog && (
        <GigEditDialog gig={gigDialog} clients={gigClients} onClose={() => setGigDialog(null)} />
      )}
    </div>
  );
}
