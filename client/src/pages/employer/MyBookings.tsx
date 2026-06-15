// ============================================================
// FMS Phase 1 — My Bookings Page (Employer Dashboard)
// File: client/src/pages/employer/MyBookings.tsx
// ============================================================

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { BriefStatusBadge } from "@/components/fms/BriefStatusBadge";
import { Ir35StatusBadge } from "@/components/fms/Ir35StatusBadge";
import { useSearch } from "wouter";
import { ChevronDown, ChevronUp, Pencil, PoundSterling, Tag, X, Plus, Save } from "lucide-react";

// ── Types ─────────────────────────────────────────────────
type BookingStatus =
  | "enquired"
  | "confirmed"
  | "briefed"
  | "completed"
  | "cancelled";

interface BookingResult {
  booking: {
    id: number;
    status: BookingStatus;
    agreedRate: string | null;
    callTime: string | null;
    venueAddress: string | null;
    employerNotes: string | null;
    cancellationReason: string | null;
    roleRequired: string | null;
    skillTags: string[] | null;
    agreedBudget: number | null;
    actualCost: number | null;
    expenses: number | null;
    budgetNotes: string | null;
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
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}
    >
      {config.label}
    </span>
  );
}

// ── Booking Card ──────────────────────────────────────────
function BookingCard({
  result,
  onStatusChange,
  highlight,
}: {
  result: BookingResult;
  onStatusChange: (bookingId: number, status: BookingStatus, cancellationReason?: string) => void;
  highlight?: boolean;
}) {
  const { booking, job, freelancer } = result;
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    roleRequired: booking.roleRequired ?? "",
    skillTags: booking.skillTags ?? [] as string[],
    agreedBudget: booking.agreedBudget ? (booking.agreedBudget / 100).toString() : "",
    actualCost: booking.actualCost ? (booking.actualCost / 100).toString() : "",
    expenses: booking.expenses ? (booking.expenses / 100).toString() : "",
    budgetNotes: booking.budgetNotes ?? "",
  });
  const [newTag, setNewTag] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const updateDetailsMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/bookings/${booking.id}/details`, {
        method: "PATCH",
        body: JSON.stringify({
          roleRequired: editForm.roleRequired || null,
          skillTags: editForm.skillTags.length ? editForm.skillTags : null,
          agreedBudget: editForm.agreedBudget ? Math.round(parseFloat(editForm.agreedBudget) * 100) : null,
          actualCost: editForm.actualCost ? Math.round(parseFloat(editForm.actualCost) * 100) : null,
          expenses: editForm.expenses ? Math.round(parseFloat(editForm.expenses) * 100) : null,
          budgetNotes: editForm.budgetNotes || null,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/employer"] });
      setShowEdit(false);
    },
  });

  useEffect(() => {
    if (highlight && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlight]);
  const statusConfig = STATUS_CONFIG[booking.status];
  const nextStatuses = statusConfig.next.filter((s) => s !== "cancelled");
  const canCancel = booking.status !== "completed" && booking.status !== "cancelled";

  return (
    <div
      ref={cardRef}
      className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow ${
        highlight ? "border-orange-400 ring-2 ring-orange-400" : "border-gray-200"
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{job.title}</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {job.location}
            {job.eventDate && (
              <span className="ml-2 text-orange-600 font-medium">
                · {format(new Date(job.eventDate), "d MMM yyyy")}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusBadge status={booking.status} />
          <Ir35StatusBadge status={booking.ir35Status} />
        </div>
      </div>

      {/* Freelancer info */}
      <div className="p-4 flex items-center gap-3 border-b border-gray-100">
        <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
          {freelancer.profilePicture ? (
            <img
              src={freelancer.profilePicture}
              alt={`${freelancer.firstName} ${freelancer.lastName}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm font-medium">
              {freelancer.firstName[0]}
              {freelancer.lastName[0]}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900">
            {freelancer.firstName} {freelancer.lastName}
          </p>
          {booking.status !== "enquired" && (
            <div className="flex gap-3 mt-0.5">
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
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 grid grid-cols-3 gap-3 text-sm">
          {booking.agreedRate && (
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide">Rate</p>
              <p className="font-medium text-gray-900">£{booking.agreedRate}</p>
            </div>
          )}
          {booking.callTime && (
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide">Call time</p>
              <p className="font-medium text-gray-900">{booking.callTime}</p>
            </div>
          )}
          {booking.venueAddress && (
            <div className="col-span-2">
              <p className="text-gray-400 text-xs uppercase tracking-wide">Venue</p>
              <p className="font-medium text-gray-900 truncate">{booking.venueAddress}</p>
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {booking.employerNotes && (
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Notes</p>
          <p className="text-sm text-gray-600">{booking.employerNotes}</p>
        </div>
      )}

      {/* Role, Skills & Budget display */}
      {(booking.roleRequired || booking.skillTags?.length || booking.agreedBudget) && !showEdit && (
        <div className="px-4 py-3 border-b border-gray-100 space-y-2">
          {booking.roleRequired && (
            <div className="flex items-center gap-2 text-sm">
              <Tag className="h-3.5 w-3.5 text-gray-400" />
              <span className="font-medium text-gray-700">{booking.roleRequired}</span>
            </div>
          )}
          {booking.skillTags?.length ? (
            <div className="flex flex-wrap gap-1">
              {booking.skillTags.map((t) => (
                <span key={t} className="rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-xs text-orange-700">{t}</span>
              ))}
            </div>
          ) : null}
          {booking.agreedBudget ? (
            <div className="flex gap-4 text-sm">
              <span className="text-gray-400">Budget: <span className="text-gray-700 font-medium">£{(booking.agreedBudget / 100).toFixed(2)}</span></span>
              {booking.actualCost ? <span className="text-gray-400">Actual: <span className="text-gray-700 font-medium">£{(booking.actualCost / 100).toFixed(2)}</span></span> : null}
              {booking.expenses ? <span className="text-gray-400">Expenses: <span className="text-gray-700 font-medium">£{(booking.expenses / 100).toFixed(2)}</span></span> : null}
            </div>
          ) : null}
        </div>
      )}

      {/* Inline edit panel */}
      {showEdit && (
        <div className="px-4 py-4 border-b border-gray-100 bg-gray-50 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Role, Skills & Budget</p>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Role for this booking</label>
            <input
              className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
              value={editForm.roleRequired}
              onChange={(e) => setEditForm((f) => ({ ...f, roleRequired: e.target.value }))}
              placeholder="e.g. FOH Engineer"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Skill / equipment tags</label>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {editForm.skillTags.map((t) => (
                <span key={t} className="flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
                  {t}
                  <button onClick={() => setEditForm((f) => ({ ...f, skillTags: f.skillTags.filter((s) => s !== t) }))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add tag (e.g. Midas M32)"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTag.trim()) {
                    setEditForm((f) => ({ ...f, skillTags: [...f.skillTags, newTag.trim()] }));
                    setNewTag("");
                  }
                }}
              />
              <button
                className="rounded-lg border border-gray-200 px-2 py-1.5 text-gray-500 hover:bg-gray-100"
                onClick={() => { if (newTag.trim()) { setEditForm((f) => ({ ...f, skillTags: [...f.skillTags, newTag.trim()] })); setNewTag(""); } }}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: "agreedBudget", label: "Budget (£)" },
              { key: "actualCost", label: "Actual cost (£)" },
              { key: "expenses", label: "Expenses (£)" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
                  value={(editForm as any)[key]}
                  onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Budget notes</label>
            <input
              className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
              value={editForm.budgetNotes}
              onChange={(e) => setEditForm((f) => ({ ...f, budgetNotes: e.target.value }))}
              placeholder="Optional notes"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
              onClick={() => setShowEdit(false)}
            >
              Cancel
            </button>
            <button
              className="flex items-center gap-1 rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700"
              onClick={() => updateDetailsMutation.mutate()}
              disabled={updateDetailsMutation.isPending}
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </button>
          </div>
        </div>
      )}

      {/* Cancellation info */}
      {booking.status === "cancelled" && (
        <div className="px-4 py-3 border-b border-gray-100 bg-red-50">
          <p className="text-xs text-red-600 uppercase tracking-wide mb-1">Cancelled</p>
          {booking.cancellationReason && (
            <p className="text-sm text-red-700">{booking.cancellationReason}</p>
          )}
        </div>
      )}

      {/* Brief status */}
      {(booking.status === "confirmed" || booking.status === "briefed") && (
        <div className="px-4 py-3 border-b border-gray-100">
          <BriefStatusBadge
            bookingId={booking.id}
            bookingStatus={booking.status}
            booking={booking}
            job={job}
          />
        </div>
      )}

      {/* Actions */}
      {(nextStatuses.length > 0 || canCancel) && (
        <div className="p-4 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowEdit((v) => !v)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            {showEdit ? "Close" : "Edit details"}
          </button>
          {nextStatuses.map((nextStatus) => (
            <button
              key={nextStatus}
              onClick={() => onStatusChange(booking.id, nextStatus)}
              className="px-3 py-1.5 text-sm font-medium bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              {NEXT_STATUS_LABELS[booking.status]}
            </button>
          ))}
          {canCancel && !showCancel && (
            <button
              onClick={() => setShowCancel(true)}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel booking
            </button>
          )}
          {showCancel && (
            <div className="w-full mt-2 space-y-2">
              <input
                type="text"
                placeholder="Reason for cancellation (optional)"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onStatusChange(booking.id, "cancelled", cancelReason || undefined);
                    setShowCancel(false);
                  }}
                  className="px-3 py-1.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
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
          Created {format(new Date(booking.createdAt), "d MMM yyyy")} ·{" "}
          Updated {format(new Date(booking.updatedAt), "d MMM yyyy 'at' HH:mm")}
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
    <div className="grid grid-cols-4 gap-4 mb-6">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-white rounded-xl border border-gray-200 p-4 text-center"
        >
          <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
          <p className="text-xs text-gray-500 mt-1">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────
export default function MyBookings() {
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<BookingStatus | "all">("all");
  const search = useSearch();
  const highlightBookingId = (() => {
    const v = new URLSearchParams(search).get("booking");
    return v ? parseInt(v) : null;
  })();

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
      return apiRequest("PATCH", `/api/bookings/${bookingId}/status`, {
        status,
        cancellationReason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/employer"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/employer/summary"] });
    },
  });

  const handleStatusChange = (bookingId: number, status: BookingStatus, cancellationReason?: string) => {
    statusMutation.mutate({ bookingId, status, cancellationReason });
  };

  const filteredBookings =
    bookingsData?.filter(
      (r) => activeFilter === "all" || r.booking.status === activeFilter
    ) ?? [];

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
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Bookings</h1>
        <p className="text-gray-500 mt-1">
          Track and manage your freelance crew bookings
        </p>
      </div>

      {/* Summary counts */}
      {summary && <BookingsSummary summary={summary} />}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 overflow-x-auto">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`flex-shrink-0 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeFilter === tab.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
            {filterCounts[tab.key] > 0 && (
              <span className="ml-1.5 text-xs bg-gray-200 text-gray-600 rounded-full px-1.5 py-0.5">
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
            <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No bookings yet</h3>
          <p className="text-gray-500 text-sm">
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
              highlight={result.booking.id === highlightBookingId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
