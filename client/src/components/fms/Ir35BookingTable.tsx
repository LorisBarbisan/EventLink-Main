import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Loader2 } from "lucide-react";
import { IR35_COLOURS } from "./Ir35StatusBadge";

type Ir35Status = "not_assessed" | "inside" | "outside" | "undetermined";

interface BookingRow {
  booking: {
    id: number;
    eventDate: string | null;
    status: string;
    agreedRate: string | null;
    ir35Status: Ir35Status | null;
    ir35Notes: string | null;
  };
  freelancerFirstName: string | null;
  freelancerLastName: string | null;
  freelancerTitle: string | null;
  jobTitle: string | null;
}

interface RowState {
  ir35Status: Ir35Status;
  ir35Notes: string;
  dirty: boolean;
  saved: boolean;
}

const ACTIVE_STATUSES = new Set(["confirmed", "briefed", "completed"]);

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  confirmed: { label: "Confirmed", className: "bg-blue-100 text-blue-700" },
  briefed: { label: "Briefed", className: "bg-purple-100 text-purple-700" },
  completed: { label: "Completed", className: "bg-green-100 text-green-700" },
};

export function Ir35BookingTable() {
  const { toast } = useToast();
  const [rowState, setRowState] = useState<Record<number, RowState>>({});

  const { data: allBookings = [], isLoading } = useQuery<BookingRow[]>({
    queryKey: ["/api/bookings/calendar"],
    queryFn: () => apiRequest("/api/bookings/calendar"),
    select: (data) => data.filter((r: BookingRow) => ACTIVE_STATUSES.has(r.booking.status)),
  });

  const getRow = (b: BookingRow): RowState =>
    rowState[b.booking.id] ?? {
      ir35Status: (b.booking.ir35Status as Ir35Status) ?? "not_assessed",
      ir35Notes: b.booking.ir35Notes ?? "",
      dirty: false,
      saved: false,
    };

  const updateRow = (id: number, patch: Partial<RowState>) => {
    setRowState((prev) => ({
      ...prev,
      [id]: { ...getRow({ booking: { id } } as any), ...prev[id], ...patch, dirty: true, saved: false },
    }));
  };

  const ir35Mutation = useMutation({
    mutationFn: ({
      bookingId,
      ir35Status,
      ir35Notes,
    }: {
      bookingId: number;
      ir35Status: string;
      ir35Notes?: string;
    }) =>
      apiRequest(`/api/bookings/${bookingId}/ir35`, {
        method: "PATCH",
        body: JSON.stringify({ ir35Status, ir35Notes }),
      }),
    onSuccess: (_, vars) => {
      toast({ title: "IR35 status saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/calendar"] });
      setRowState((prev) => ({
        ...prev,
        [vars.bookingId]: { ...prev[vars.bookingId], dirty: false, saved: true },
      }));
    },
    onError: () => toast({ title: "Failed to save IR35 status", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  if (allBookings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No confirmed bookings yet. IR35 status can be recorded once a booking is confirmed.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b">
            <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Event Date</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Freelancer</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Role</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Status</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">IR35 Status</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap min-w-[180px]">Notes</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {allBookings.map((row) => {
            const state = getRow(row);
            const colours = IR35_COLOURS[state.ir35Status] ?? IR35_COLOURS.not_assessed;
            const isPending = ir35Mutation.isPending && (ir35Mutation.variables as any)?.bookingId === row.booking.id;
            const statusCfg = STATUS_BADGE[row.booking.status];

            return (
              <tr key={row.booking.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                  {row.booking.eventDate
                    ? format(new Date(row.booking.eventDate), "dd/MM/yyyy")
                    : "—"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
                  {`${row.freelancerFirstName ?? ""} ${row.freelancerLastName ?? ""}`.trim() || "—"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                  {row.freelancerTitle ?? row.jobTitle ?? "—"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {statusCfg && (
                    <Badge className={`${statusCfg.className} border-0 text-xs`}>
                      {statusCfg.label}
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Select
                    value={state.ir35Status}
                    onValueChange={(val) => updateRow(row.booking.id, { ir35Status: val as Ir35Status })}
                  >
                    <SelectTrigger
                      className="h-8 text-xs w-40"
                      style={{ backgroundColor: colours.bg, color: colours.text, borderColor: colours.bg }}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_assessed">Not assessed</SelectItem>
                      <SelectItem value="outside">Outside IR35</SelectItem>
                      <SelectItem value="inside">Inside IR35</SelectItem>
                      <SelectItem value="undetermined">Undetermined</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3">
                  <Input
                    className="h-8 text-xs"
                    placeholder="Optional notes…"
                    value={state.ir35Notes}
                    onChange={(e) => updateRow(row.booking.id, { ir35Notes: e.target.value })}
                  />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {state.saved && !state.dirty ? (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <Check className="h-3.5 w-3.5" /> Saved
                    </span>
                  ) : state.dirty ? (
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-orange-500 hover:bg-orange-600"
                      disabled={isPending}
                      onClick={() =>
                        ir35Mutation.mutate({
                          bookingId: row.booking.id,
                          ir35Status: state.ir35Status,
                          ir35Notes: state.ir35Notes,
                        })
                      }
                    >
                      {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                    </Button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
