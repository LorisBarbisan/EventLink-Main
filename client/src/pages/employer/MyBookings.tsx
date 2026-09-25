// ============================================================
// FMS Phase 1 — My Bookings Page (Employer Dashboard)
// File: client/src/pages/employer/MyBookings.tsx
// ============================================================

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

// ── Types ─────────────────────────────────────────────────
type BookingStatus = "enquired" | "confirmed" | "briefed" | "completed" | "cancelled";

interface BookingResult {
  booking: {
    id: number;
    status: BookingStatus;
    agreedRate: string | null;
    currency: string | null;
    callTime: string | null;
    venueAddress: string | null;
    employerNotes: string | null;
    cancellationReason: string | null;
    createdAt: string;
    updatedAt: string;
  };
  job: {
    id: number;
    title: string;
    location: string;
    eventDate: string | null;
    payRate: string | null;
  };
  freelancer: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    profilePicture: string | null;
  };
}

// ── Status config ─────────────────────────────────────────
const STATUS_CONFIG: Record<
  BookingStatus,
  { label: string; color: string; bg: string; next: BookingStatus[] }
> = {
  enquired: {
    label: "Enquired",
    color: "text-amber-700",
    bg: "bg-amber-100",
    next: ["confirmed", "cancelled"],
  },
  confirmed: {
    label: "Confirmed",
    color: "text-blue-700",
    bg: "bg-blue-100",
    next: ["briefed", "cancelled"],
  },
  briefed: {
    label: "Briefed",
    color: "text-purple-700",
    bg: "bg-purple-100",
    next: ["completed", "cancelled"],
  },
  completed: {
    label: "Completed",
    color: "text-green-700",
    bg: "bg-green-100",
    next: [],
  },
  cancelled: {
    label: "Cancelled",
    color: "text-gray-500",
    bg: "bg-gray-100",
    next: [],
  },
};

const NEXT_STATUS_LABELS: Record<BookingStatus, string> = {
  enquired: "Mark as Confirmed",
  confirmed: "Mark as Briefed",
  briefed: "Mark as Completed",
  completed: "",
  cancelled: "",
};

// ── Status Badge ──────────────────────────────────────────
function StatusBadge({ status }: { status: BookingStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.color}`}
    >
      {config.label}
    </span>
  );
}

// ── Booking Card ──────────────────────────────────────────
function BookingCard({
  result,
  onStatusChange,
}: {
  result: BookingResult;
  onStatusChange: (bookingId: number, status: BookingStatus, cancellationReason?: string) => void;
}) {
  const { booking, job, freelancer } = result;
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const statusConfig = STATUS_CONFIG[booking.status];
  const nextStatuses = statusConfig.next.filter((s) => s !== "cancelled");
  const canCancel = booking.status !== "completed" && booking.status !== "cancelled";

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-4">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-gray-900">{job.title}</h3>
          <p className="mt-0.5 text-sm text-gray-500">
            {job.location}
            {job.eventDate && (
              <span className="ml-2 font-medium text-orange-600">
                · {format(new Date(job.eventDate), "d MMM yyyy")}
              </span>
            )}
          </p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      {/* Freelancer info */}
      <div className="flex items-center gap-3 border-b border-gray-100 p-4">
        <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-gray-100">
          {freelancer.profilePicture ? (
            <img
              src={freelancer.profilePicture}
              alt={`${freelancer.firstName} ${freelancer.lastName}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-medium text-gray-400">
              {freelancer.firstName[0]}
              {freelancer.lastName[0]}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900">
            {freelancer.firstName} {freelancer.lastName}
          </p>
          {booking.status !== "enquired" && (
            <div className="mt-0.5 flex gap-3">
              <a
                href={`mailto:${freelancer.email}`}
                className="text-xs text-orange-600 hover:underline"
              >
                {freelancer.email}
              </a>
              {freelancer.phone && (
                <a
                  href={`tel:${freelancer.phone}`}
                  className="text-xs text-orange-600 hover:underline"
                >
                  {freelancer.phone}
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Booking details */}
      {(booking.agreedRate || booking.callTime || booking.venueAddress) && (
        <div className="grid grid-cols-3 gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 text-sm">
          {booking.agreedRate && (
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Rate</p>
              <p className="font-medium text-gray-900">
                {booking.currency && booking.currency !== "GBP" ? `${booking.currency} ` : ""}
                {booking.agreedRate}
              </p>
            </div>
          )}
          {booking.callTime && (
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Call time</p>
              <p className="font-medium text-gray-900">{booking.callTime}</p>
            </div>
          )}
          {booking.venueAddress && (
            <div className="col-span-2">
              <p className="text-xs uppercase tracking-wide text-gray-400">Venue</p>
              <p className="truncate font-medium text-gray-900">{booking.venueAddress}</p>
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {booking.employerNotes && (
        <div className="border-b border-gray-100 px-4 py-3">
          <p className="mb-1 text-xs uppercase tracking-wide text-gray-400">Notes</p>
          <p className="text-sm text-gray-600">{booking.employerNotes}</p>
        </div>
      )}

      {/* Cancellation info */}
      {booking.status === "cancelled" && (
        <div className="border-b border-gray-100 bg-red-50 px-4 py-3">
          <p className="mb-1 text-xs uppercase tracking-wide text-red-600">Cancelled</p>
          {booking.cancellationReason && (
            <p className="text-sm text-red-700">{booking.cancellationReason}</p>
          )}
        </div>
      )}

      {/* Actions */}
      {(nextStatuses.length > 0 || canCancel) && (
        <div className="flex flex-wrap items-center gap-2 p-4">
          {nextStatuses.map((nextStatus) => (
            <button
              key={nextStatus}
              onClick={() => onStatusChange(booking.id, nextStatus)}
              className="rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-orange-700"
            >
              {NEXT_STATUS_LABELS[booking.status]}
            </button>
          ))}
          {canCancel && !showCancel && (
            <button
              onClick={() => setShowCancel(true)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              Cancel booking
            </button>
          )}
          {showCancel && (
            <div className="mt-2 w-full space-y-2">
              <input
                type="text"
                placeholder="Reason for cancellation (optional)"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onStatusChange(booking.id, "cancelled", cancelReason || undefined);
                    setShowCancel(false);
                  }}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
                >
                  Confirm cancellation
                </button>
                <button
                  onClick={() => setShowCancel(false)}
                  className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
                >
                  Keep booking
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer timestamp */}
      <div className="px-4 pb-3">
        <p className="text-xs text-gray-400">
          Created {format(new Date(booking.createdAt), "d MMM yyyy")} · Updated{" "}
          {format(new Date(booking.updatedAt), "d MMM yyyy 'at' HH:mm")}
        </p>
      </div>
    </div>
  );
}

// ── Summary widget ────────────────────────────────────────
function BookingsSummary({
  summary,
}: {
  summary: {
    total: number;
    enquired: number;
    confirmed: number;
    briefed: number;
    completed: number;
    cancelled: number;
  };
}) {
  const items = [
    { label: "Enquired", value: summary.enquired, color: "text-amber-600" },
    { label: "Confirmed", value: summary.confirmed, color: "text-blue-600" },
    { label: "Briefed", value: summary.briefed, color: "text-purple-600" },
    { label: "Completed", value: summary.completed, color: "text-green-600" },
  ];

  return (
    <div className="mb-6 grid grid-cols-4 gap-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-gray-200 bg-white p-4 text-center"
        >
          <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
          <p className="mt-1 text-xs text-gray-500">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────
export default function MyBookings() {
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<BookingStatus | "all">("all");

  const { data: bookingsData, isLoading } = useQuery<BookingResult[]>({
    queryKey: ["/api/bookings/employer"],
  });

  const { data: summary } = useQuery<{
    total: number;
    enquired: number;
    confirmed: number;
    briefed: number;
    completed: number;
    cancelled: number;
  }>({
    queryKey: ["/api/bookings/employer/summary"],
  });

  const statusMutation = useMutation({
    mutationFn: async ({
      bookingId,
      status,
      cancellationReason,
    }: {
      bookingId: number;
      status: BookingStatus;
      cancellationReason?: string;
    }) => {
      return apiRequest(`/api/bookings/${bookingId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, cancellationReason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/employer"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/employer/summary"] });
    },
  });

  const handleStatusChange = (
    bookingId: number,
    status: BookingStatus,
    cancellationReason?: string
  ) => {
    statusMutation.mutate({ bookingId, status, cancellationReason });
  };

  const filteredBookings =
    bookingsData?.filter((r) => activeFilter === "all" || r.booking.status === activeFilter) ?? [];

  const filterCounts: Record<string, number> = {
    all: bookingsData?.length ?? 0,
    enquired: bookingsData?.filter((r) => r.booking.status === "enquired").length ?? 0,
    confirmed: bookingsData?.filter((r) => r.booking.status === "confirmed").length ?? 0,
    briefed: bookingsData?.filter((r) => r.booking.status === "briefed").length ?? 0,
    completed: bookingsData?.filter((r) => r.booking.status === "completed").length ?? 0,
    cancelled: bookingsData?.filter((r) => r.booking.status === "cancelled").length ?? 0,
  };

  const filterTabs: Array<{ key: BookingStatus | "all"; label: string }> = [
    { key: "all", label: "All" },
    { key: "enquired", label: "Enquired" },
    { key: "confirmed", label: "Confirmed" },
    { key: "briefed", label: "Briefed" },
    { key: "completed", label: "Completed" },
    { key: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Bookings</h1>
        <p className="mt-1 text-gray-500">Track and manage your freelance crew bookings</p>
      </div>

      {/* Summary counts */}
      {summary && <BookingsSummary summary={summary} />}

      {/* Filter tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`flex-shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeFilter === tab.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
            {filterCounts[tab.key] > 0 && (
              <span className="ml-1.5 rounded-full bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600">
                {filterCounts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="py-16 text-center">
          <div className="mb-4 text-5xl">📋</div>
          <h3 className="mb-2 text-lg font-medium text-gray-900">No bookings yet</h3>
          <p className="text-sm text-gray-500">
            Bookings are created automatically when you message a freelancer about a job.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((result) => (
            <BookingCard
              key={result.booking.id}
              result={result}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
