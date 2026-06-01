import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { SiGoogle, SiMicrosoftoutlook } from "react-icons/si";
import { CalendarCheck, CalendarX, RefreshCw, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import queryClient from "@/lib/queryClient";

interface CalendarStatus {
  connected: boolean;
  provider: "google" | "outlook" | null;
  connectedAt: string | null;
}

interface SyncResult {
  success: boolean;
  synced: number;
  updated: number;
  deleted: number;
  errors: string[];
}

export default function CalendarSyncPanel() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [lastSync, setLastSync] = useState<SyncResult | null>(null);

  const { data: status, isLoading } = useQuery<CalendarStatus>({
    queryKey: ["/api/calendar/status"],
  });

  // Handle URL params on mount — feedback from OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");

    if (connected === "google") {
      toast({ title: "Google Calendar connected!", description: "Your Google Calendar is now linked to EventLink." });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/status"] });
    } else if (connected === "outlook") {
      toast({ title: "Outlook Calendar connected!", description: "Your Outlook Calendar is now linked to EventLink." });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/status"] });
    } else if (error === "connect_failed") {
      toast({ title: "Connection failed", description: "Could not connect your calendar. Please try again.", variant: "destructive" });
    } else if (error === "auth") {
      toast({ title: "Authentication error", description: "Please sign in and try again.", variant: "destructive" });
    }

    // Strip params from URL without a full navigation
    if (connected || error) {
      const url = new URL(window.location.href);
      url.searchParams.delete("connected");
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const syncMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/calendar/sync"),
    onSuccess: async (res) => {
      const data: SyncResult = await res.json();
      setLastSync(data);
      const parts = [];
      if (data.synced) parts.push(`${data.synced} created`);
      if (data.updated) parts.push(`${data.updated} updated`);
      if (data.deleted) parts.push(`${data.deleted} deleted`);
      const summary = parts.length ? parts.join(", ") : "Nothing to sync";
      toast({ title: "Calendar synced", description: summary });
    },
    onError: () => {
      toast({ title: "Sync failed", description: "Could not sync to calendar. Please try again.", variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/calendar/disconnect"),
    onSuccess: () => {
      toast({ title: "Calendar disconnected" });
      setLastSync(null);
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/status"] });
    },
    onError: () => {
      toast({ title: "Disconnect failed", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5 animate-pulse h-24" />
    );
  }

  const providerLabel = status?.provider === "google" ? "Google Calendar" : "Outlook Calendar";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
      {status?.connected ? (
        /* ── Connected state ── */
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center shrink-0">
              <CalendarCheck className="w-4 h-4 text-green-600" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-900 text-sm">
                  Connected to {providerLabel}
                </span>
                <Badge className="bg-green-100 text-green-700 border-0 text-xs">Active</Badge>
              </div>
              {status.connectedAt && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Since{" "}
                  {new Date(status.connectedAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
              {lastSync && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Last sync:{" "}
                  {[
                    lastSync.synced ? `${lastSync.synced} created` : "",
                    lastSync.updated ? `${lastSync.updated} updated` : "",
                    lastSync.deleted ? `${lastSync.deleted} deleted` : "",
                  ]
                    .filter(Boolean)
                    .join(", ") || "Nothing to sync"}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
              size="sm"
            >
              <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              {syncMutation.isPending ? "Syncing…" : "Sync to Calendar"}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors">
                  <Unplug className="w-3 h-3" />
                  Disconnect
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disconnect calendar?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove the calendar connection. Existing calendar events created by
                    EventLink will not be deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => disconnectMutation.mutate()}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Disconnect
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      ) : (
        /* ── Disconnected state ── */
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
              <CalendarX className="w-4 h-4 text-gray-400" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Sync bookings to your calendar</p>
              <p className="text-xs text-gray-500">
                Connect Google Calendar or Outlook to keep your schedule in sync.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="gap-2 border-gray-300 hover:border-gray-400 text-sm"
              onClick={() => {
                window.location.href = "/api/calendar/google/connect";
              }}
            >
              <SiGoogle className="w-4 h-4 text-[#4285F4]" />
              Connect Google Calendar
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-gray-300 hover:border-gray-400 text-sm"
              onClick={() => {
                window.location.href = "/api/calendar/outlook/connect";
              }}
            >
              <SiMicrosoftoutlook className="w-4 h-4 text-[#0078D4]" />
              Connect Outlook Calendar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
