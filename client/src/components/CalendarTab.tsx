import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
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

function isoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const MONTH_NAMES = [
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

const DAY_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const STATUS_CELL: Record<string, string> = {
  available: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  tentative: "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30",
  unavailable: "bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30",
};

const STATUS_DOT: Record<string, string> = {
  available: "bg-emerald-500",
  tentative: "bg-amber-500",
  unavailable: "bg-rose-500",
};

// ── Grid calendar ─────────────────────────────────────────────────────────────

function CalendarGrid({
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

  const today = new Date().toISOString().slice(0, 10);

  // Day-of-week the month starts on (Mon=0 … Sun=6)
  const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const days = daysInMonth(year, month);

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  // pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      {/* Day headers */}
      <div className="mb-1 grid grid-cols-7 gap-1">
        {DAY_ABBR.map((d) => (
          <div key={d} className="py-1 text-center text-[11px] font-medium text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;
          const date = isoDate(year, month, day);
          const avail = availMap[date];
          const isToday = date === today;
          return (
            <button
              key={date}
              onClick={() => onDayTap(date)}
              className={`relative flex h-9 w-full flex-col items-center justify-center rounded-md border text-xs transition-colors hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${avail ? STATUS_CELL[avail.status] : "border-border bg-background"} ${isToday && !avail ? "border-primary font-semibold text-primary" : ""} `}
            >
              <span className={isToday && !avail ? "text-primary" : ""}>{day}</span>
              {avail && (
                <span className={`mt-0.5 h-1 w-1 rounded-full ${STATUS_DOT[avail.status]}`} />
              )}
            </button>
          );
        })}
      </div>
      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        {[
          { key: "available", label: "Available" },
          { key: "tentative", label: "Tentative" },
          { key: "unavailable", label: "Unavailable" },
        ].map(({ key, label }) => (
          <span key={key} className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[key]}`} />
            {label}
          </span>
        ))}
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

  const [d, m, y] = [
    new Date(`${date}T12:00:00`).getDate(),
    MONTH_NAMES[new Date(`${date}T12:00:00`).getMonth()],
    new Date(`${date}T12:00:00`).getFullYear(),
  ];

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {d} {m} {y}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="avail-status">Availability</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="avail-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">✅ Available</SelectItem>
                <SelectItem value="tentative">⚠️ Tentative</SelectItem>
                <SelectItem value="unavailable">❌ Unavailable</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="avail-note">Note (optional)</Label>
            <Textarea
              id="avail-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Travelling, Holiday…"
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
              <X className="mr-1.5 h-3.5 w-3.5" />
              Clear
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
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const { data: availData } = useQuery<AvailabilityEntry[]>({
    queryKey: ["/api/calendar/availability", year, month],
    queryFn: () => {
      const start = isoDate(year, month, 1);
      const end = isoDate(year, month, daysInMonth(year, month));
      return apiRequest(`/api/calendar/availability?from=${start}&to=${end}`).then((r) => r.json());
    },
    enabled: !!user,
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
  const isConnected = calStatus?.connected;
  const needsReconnect = calStatus?.status === "needs_reconnect" || calStatus?.status === "error";

  // ── Calendar nav header (shared) ──────────────────────────────────────────

  const CalendarNav = (
    <div className="flex items-center gap-1">
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={prevMonth}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="w-32 text-center text-sm font-medium">
        {MONTH_NAMES[month - 1]} {year}
      </span>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={nextMonth}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* ── Connection card ─────────────────────────────────────── */}
      {isConnected ? (
        <Card className={needsReconnect ? "border-amber-500/40" : "border-emerald-500/30"}>
          <CardContent className="py-4">
            <div className="flex flex-wrap items-start gap-3">
              <div
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${needsReconnect ? "bg-amber-500/15" : "bg-emerald-500/15"}`}
              >
                {needsReconnect ? (
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">
                  {calStatus.provider === "google" ? "Google Calendar" : "Outlook Calendar"}{" "}
                  <span
                    className={`font-normal ${needsReconnect ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}
                  >
                    {needsReconnect ? "needs reconnecting" : "connected"}
                  </span>
                </p>
                {calStatus.last_read_sync_at && (
                  <p className="text-xs text-muted-foreground">
                    Last sync: {fmtDateTime(calStatus.last_read_sync_at)}
                  </p>
                )}
                {needsReconnect && calStatus.last_error && (
                  <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                    {calStatus.last_error}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {needsReconnect && calStatus.provider && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-500/50"
                    onClick={() => handleConnect(calStatus.provider!)}
                  >
                    Reconnect
                  </Button>
                )}
                {!needsReconnect && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={syncMut.isPending}
                    onClick={() => syncMut.mutate()}
                  >
                    <RefreshCw
                      className={`mr-1.5 h-3.5 w-3.5 ${syncMut.isPending ? "animate-spin" : ""}`}
                    />
                    Sync now
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => disconnectMut.mutate()}
                >
                  <Unlink className="mr-1.5 h-3.5 w-3.5" />
                  Disconnect
                </Button>
              </div>
            </div>

            {/* Sync settings */}
            {!needsReconnect && (
              <div className="mt-4 grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-3">
                {[
                  {
                    key: "push_bookings",
                    label: "Push bookings to calendar",
                    value: calStatus.push_bookings,
                  },
                  {
                    key: "push_availability",
                    label: "Block unavailable days",
                    value: calStatus.push_availability,
                  },
                  {
                    key: "read_external",
                    label: "Import external events",
                    value: calStatus.read_external,
                  },
                ].map(({ key, label, value }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
                  >
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <Switch
                      checked={!!value}
                      onCheckedChange={async (checked) => {
                        try {
                          await apiRequest("/api/calendar/preferences", {
                            method: "PATCH",
                            body: JSON.stringify({ [key]: checked }),
                          });
                          queryClient.invalidateQueries({ queryKey: ["/api/calendar/status"] });
                        } catch {
                          toast({ title: "Failed to update setting", variant: "destructive" });
                        }
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
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
                ? "Sync your confirmed bookings to Google Calendar or Outlook, and let the platform know when you're unavailable."
                : "Connect your calendar to automatically sync bookings and block availability. Upgrade to Pro to unlock this feature."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={!isPro} onClick={() => isPro && handleConnect("google")}>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none">
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
                size="sm"
                variant="outline"
                disabled={!isPro}
                onClick={() => isPro && handleConnect("outlook")}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M24 12.075C24 5.406 18.627 0 12 0S0 5.406 0 12.075c0 6.025 4.388 11.02 10.125 11.919V15.56H7.078v-3.485h3.047V9.41c0-3.025 1.793-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.971H15.83c-1.491 0-1.956.93-1.956 1.886v2.269h3.328l-.532 3.485h-2.796v8.433C19.612 23.095 24 18.1 24 12.075z"
                    fill="#1877F2"
                  />
                </svg>
                Connect Outlook
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Availability calendar ───────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Availability</CardTitle>
            {CalendarNav}
          </div>
          <p className="text-xs text-muted-foreground">
            Tap a day to mark your availability. This is visible to employers searching for
            freelancers.
          </p>
        </CardHeader>
        <CardContent>
          <CalendarGrid
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
