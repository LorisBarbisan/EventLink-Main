import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Unlink,
  X,
  Lock,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${day} ${months[m - 1]} ${y}`;
}

function isoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

const STATUS_LABEL: Record<string, string> = {
  available: "Available",
  tentative: "Tentative",
  unavailable: "Unavailable",
};

const STATUS_COLOR: Record<string, string> = {
  available: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  tentative: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  unavailable: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
};

// ── Connection status banner ─────────────────────────────────────────────────

function ConnectionBanner({
  status,
  onReconnect,
  onDisconnect,
  syncing,
  onSync,
}: {
  status: CalendarStatus;
  onReconnect: (provider: "google" | "outlook") => void;
  onDisconnect: () => void;
  syncing: boolean;
  onSync: () => void;
}) {
  if (!status.connected) return null;

  const isOk = status.status === "active";
  const needsReconnect = status.status === "needs_reconnect" || status.status === "error";

  return (
    <Card className={needsReconnect ? "border-amber-500/50 bg-amber-500/5" : ""}>
      <CardContent className="flex flex-wrap items-center gap-3 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {isOk ? (
            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium leading-none">
              {status.provider === "google" ? "Google Calendar" : "Outlook Calendar"} connected
            </p>
            {needsReconnect && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {status.last_error ?? "Reconnection required"}
              </p>
            )}
            {isOk && status.last_read_sync_at && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Last sync {fmtDate(status.last_read_sync_at.slice(0, 10))}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {needsReconnect && status.provider && (
            <Button
              size="sm"
              variant="outline"
              className="border-amber-500/50"
              onClick={() => onReconnect(status.provider!)}
            >
              Reconnect
            </Button>
          )}
          {isOk && (
            <Button size="sm" variant="ghost" disabled={syncing} onClick={onSync}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Sync now</span>
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            onClick={onDisconnect}
          >
            <Unlink className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Disconnect</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Connect card ─────────────────────────────────────────────────────────────

function ConnectCard({
  isPro,
  onConnect,
}: {
  isPro: boolean;
  onConnect: (provider: "google" | "outlook") => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4" />
          Connect a calendar
          {!isPro && (
            <Badge variant="secondary" className="ml-auto">
              <Lock className="mr-1 h-3 w-3" />
              Pro
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {isPro
            ? "Connect Google Calendar or Outlook to automatically push your confirmed bookings and block availability in your personal calendar."
            : "Connect your calendar to automatically sync bookings and mark yourself unavailable on booked days. Upgrading to Pro unlocks calendar sync."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={!isPro} onClick={() => isPro && onConnect("google")}>
            Connect Google Calendar
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!isPro}
            onClick={() => isPro && onConnect("outlook")}
          >
            Connect Outlook
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Month view ────────────────────────────────────────────────────────────────

function MonthView({
  year,
  month,
  availability,
  onDayTap,
}: {
  year: number;
  month: number;
  availability: AvailabilityEntry[];
  onDayTap: (date: string) => void;
}) {
  const availMap: Record<string, AvailabilityEntry> = {};
  for (const a of availability) availMap[a.date] = a;

  const days = daysInMonth(year, month);
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  // List of day objects
  const dayList: { date: string; day: number; avail?: AvailabilityEntry }[] = [];
  for (let d = 1; d <= days; d++) {
    const dateStr = isoDate(year, month, d);
    dayList.push({ date: dateStr, day: d, avail: availMap[dateStr] });
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-1">
      <p className="px-1 text-xs text-muted-foreground">
        {monthNames[month - 1]} {year} — tap a day to mark availability
      </p>
      <div className="space-y-1.5">
        {dayList.map(({ date, day, avail }) => {
          const isToday = date === today;
          return (
            <button
              key={date}
              onClick={() => onDayTap(date)}
              className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isToday ? "border-primary/50 bg-primary/5" : "border-border"}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-7 font-mono text-xs tabular-nums ${isToday ? "font-semibold text-primary" : "text-muted-foreground"}`}
                >
                  {String(day).padStart(2, " ")}
                </span>
                <span className="flex-1 text-xs text-muted-foreground">
                  {new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short" })}
                </span>
                {avail ? (
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[avail.status]}`}
                  >
                    {STATUS_LABEL[avail.status]}
                    {avail.note && <span className="ml-1 opacity-70">· {avail.note}</span>}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground/40">tap to set</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
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
  date: string;
  existing?: AvailabilityEntry;
  onSave: (date: string, status: string, note: string) => void;
  onDelete: (date: string) => void;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<string>(existing?.status ?? "unavailable");
  const [note, setNote] = useState(existing?.note ?? "");

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{fmtDate(date)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="avail-status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="avail-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="tentative">Tentative</SelectItem>
                <SelectItem value="unavailable">Unavailable</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="avail-note">Note (optional)</Label>
            <Textarea
              id="avail-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Travelling"
              rows={2}
              className="resize-none"
            />
          </div>
        </div>
        <DialogFooter className="flex-row gap-2">
          {existing && (
            <Button
              variant="ghost"
              size="sm"
              className="mr-auto text-muted-foreground"
              onClick={() => onDelete(date)}
            >
              <X className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => onSave(date, status, note)}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function CalendarTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isPro = (user as any)?.subscription_tier === "pro" || (user as any)?.tier === "pro";

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [availDialog, setAvailDialog] = useState<string | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: calStatus } = useQuery<CalendarStatus>({
    queryKey: ["/api/calendar/status"],
    enabled: !!user && isPro,
  });

  const { data: availData } = useQuery<AvailabilityEntry[]>({
    queryKey: ["/api/calendar/availability", year, month],
    queryFn: () => {
      const start = isoDate(year, month, 1);
      const end = isoDate(year, month, daysInMonth(year, month));
      return apiRequest(`/api/calendar/availability?from=${start}&to=${end}`).then((r) => r.json());
    },
    enabled: !!user && isPro,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const syncMut = useMutation({
    mutationFn: () => apiRequest("/api/calendar/sync", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/status"] });
      toast({ title: "Sync triggered", description: "Your calendar will update shortly." });
    },
    onError: () => toast({ title: "Sync failed", variant: "destructive" }),
  });

  const disconnectMut = useMutation({
    mutationFn: () => apiRequest("/api/calendar/disconnect", { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/status"] });
      toast({ title: "Calendar disconnected" });
    },
    onError: () => toast({ title: "Disconnect failed", variant: "destructive" }),
  });

  const setAvailMut = useMutation({
    mutationFn: ({ date, status, note }: { date: string; status: string; note: string }) =>
      apiRequest("/api/calendar/availability", {
        method: "PUT",
        body: JSON.stringify({ date, status, note: note || null }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/availability", year, month] });
      setAvailDialog(null);
      toast({ title: "Availability saved" });
    },
    onError: () => toast({ title: "Failed to save availability", variant: "destructive" }),
  });

  const deleteAvailMut = useMutation({
    mutationFn: (date: string) =>
      apiRequest(`/api/calendar/availability/${date}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/availability", year, month] });
      setAvailDialog(null);
      toast({ title: "Availability cleared" });
    },
    onError: () => toast({ title: "Failed to clear availability", variant: "destructive" }),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  function calendarConnectUrl(provider: "google" | "outlook"): string {
    const token = localStorage.getItem("auth_token") ?? "";
    return `/api/calendar/${provider}/connect?token=${encodeURIComponent(token)}`;
  }

  function handleConnect(provider: "google" | "outlook") {
    window.location.href = calendarConnectUrl(provider);
  }

  function handleReconnect(provider: "google" | "outlook") {
    window.location.href = calendarConnectUrl(provider);
  }

  function prevMonth() {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else setMonth((m) => m + 1);
  }

  const selectedAvail = availDialog
    ? (availData ?? []).find((a) => a.date === availDialog)
    : undefined;

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  // ── Free-tier wall ────────────────────────────────────────────────────────

  if (!isPro) {
    return (
      <div className="space-y-4">
        <ConnectCard isPro={false} onConnect={handleConnect} />
        <Card>
          <CardContent className="space-y-2 py-6 text-center">
            <Lock className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Availability marking and calendar sync are Pro features.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Pro: not connected ────────────────────────────────────────────────────

  if (!calStatus?.connected) {
    return (
      <div className="space-y-4">
        <ConnectCard isPro={true} onConnect={handleConnect} />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>Availability</span>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={prevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="w-28 text-center text-sm font-normal">
                  {monthNames[month - 1]} {year}
                </span>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={nextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MonthView
              year={year}
              month={month}
              availability={availData ?? []}
              onDayTap={setAvailDialog}
            />
          </CardContent>
        </Card>

        {availDialog && (
          <AvailabilityDialog
            date={availDialog}
            existing={selectedAvail}
            onSave={(date, status, note) => setAvailMut.mutate({ date, status, note })}
            onDelete={(date) => deleteAvailMut.mutate(date)}
            onClose={() => setAvailDialog(null)}
          />
        )}
      </div>
    );
  }

  // ── Pro: connected ────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <ConnectionBanner
        status={calStatus}
        onReconnect={handleReconnect}
        onDisconnect={() => disconnectMut.mutate()}
        syncing={syncMut.isPending}
        onSync={() => syncMut.mutate()}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>Availability</span>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={prevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="w-28 text-center text-sm font-normal">
                {monthNames[month - 1]} {year}
              </span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MonthView
            year={year}
            month={month}
            availability={availData ?? []}
            onDayTap={setAvailDialog}
          />
        </CardContent>
      </Card>

      {availDialog && (
        <AvailabilityDialog
          date={availDialog}
          existing={selectedAvail}
          onSave={(date, status, note) => setAvailMut.mutate({ date, status, note })}
          onDelete={(date) => deleteAvailMut.mutate(date)}
          onClose={() => setAvailDialog(null)}
        />
      )}
    </div>
  );
}
