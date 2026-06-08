// ============================================================
// FMS Phase 1 — My Jobs Page (Freelancer Dashboard)
// File: client/src/pages/freelancer/MyJobs.tsx
// ============================================================

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { JobDocumentsModal } from "@/components/JobDocumentsModal";

type BookingStatus = "enquired" | "confirmed" | "briefed" | "completed" | "cancelled";

interface FreelancerBookingResult {
  booking: {
    id: number;
    status: BookingStatus;
    agreedRate: string | null;
    callTime: string | null;
    venueAddress: string | null;
    cancellationReason: string | null;
    cancelledBy: string | null;
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
  employer: {
    id: number;
    firstName: string;
    lastName: string;
    companyName: string | null;
    profilePicture: string | null;
  };
}

const STATUS_LABELS: Record<BookingStatus, { label: string; color: string; bg: string }> = {
  enquired: { label: "Enquired", color: "text-amber-700", bg: "bg-amber-100" },
  confirmed: { label: "Confirmed ✓", color: "text-blue-700", bg: "bg-blue-100" },
  briefed: { label: "Briefed", color: "text-purple-700", bg: "bg-purple-100" },
  completed: { label: "Completed", color: "text-green-700", bg: "bg-green-100" },
  cancelled: { label: "Cancelled", color: "text-gray-500", bg: "bg-gray-100" },
};

export default function MyJobs() {
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<BookingStatus | "all">("all");
  const [docsJobId, setDocsJobId] = useState<number | null>(null);
  const [docsJobTitle, setDocsJobTitle] = useState<string>("");

  const { data: bookings, isLoading } = useQuery<FreelancerBookingResult[]>({
    queryKey: ["/api/bookings/freelancer"],
  });

  const cancelMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      return apiRequest("PATCH", `/api/bookings/${bookingId}/status`, {
        status: "cancelled",
        cancellationReason: "Cancelled by freelancer",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/freelancer"] });
    },
  });

  const filtered =
    bookings?.filter((r) => activeFilter === "all" || r.booking.status === activeFilter) ?? [];

  const upcoming = filtered.filter(
    (r) =>
      ["confirmed", "briefed"].includes(r.booking.status) &&
      r.job.eventDate &&
      new Date(r.job.eventDate) >= new Date()
  );
  const other = filtered.filter((r) => !upcoming.includes(r));

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Jobs</h1>
        <p className="text-gray-500 mt-1">Jobs you've been booked for through EventLink</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 overflow-x-auto">
        {(["all", "enquired", "confirmed", "briefed", "completed", "cancelled"] as const).map(
          (f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`flex-shrink-0 px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
                activeFilter === f
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {f}
            </button>
          )
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">📅</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No bookings yet</h3>
          <p className="text-gray-500 text-sm">
            When an employer books you through EventLink, it will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {upcoming.length > 0 && (
            <h2 className="text-sm font-semibold text-orange-600 uppercase tracking-wide mt-4 mb-2">
              Upcoming
            </h2>
          )}
          {[...upcoming, ...other].map((result) => {
            const { booking, job, employer } = result;
            const statusConfig = STATUS_LABELS[booking.status];
            return (
              <div
                key={booking.id}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{job.title}</h3>
                    <p className="text-sm text-gray-500">
                      {job.location}
                      {job.eventDate && (
                        <span className="ml-2 text-orange-600 font-medium">
                          · {format(new Date(job.eventDate), "d MMM yyyy")}
                        </span>
                      )}
                    </p>
                  </div>
                  <span
                    className={`flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${statusConfig.bg} ${statusConfig.color}`}
                  >
                    {statusConfig.label}
                  </span>
                </div>

                {/* Employer info */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
                    {employer.profilePicture ? (
                      <img
                        src={employer.profilePicture}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                        {employer.firstName[0]}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    {employer.companyName || `${employer.firstName} ${employer.lastName}`}
                  </p>
                </div>

                {/* Booking details */}
                {(booking.agreedRate || booking.callTime) && (
                  <div className="flex gap-4 text-sm mb-3">
                    {booking.agreedRate && (
                      <div>
                        <span className="text-gray-400">Rate: </span>
                        <span className="font-medium text-gray-900">£{booking.agreedRate}</span>
                      </div>
                    )}
                    {booking.callTime && (
                      <div>
                        <span className="text-gray-400">Call time: </span>
                        <span className="font-medium text-gray-900">{booking.callTime}</span>
                      </div>
                    )}
                  </div>
                )}

                {booking.venueAddress && (
                  <p className="text-sm text-gray-500 mb-3">📍 {booking.venueAddress}</p>
                )}

                {booking.status === "cancelled" && booking.cancellationReason && (
                  <p className="text-sm text-red-600 mb-3">
                    Cancelled: {booking.cancellationReason}
                  </p>
                )}

                {/* Docs button */}
                {booking.status !== "cancelled" && (
                  <button
                    onClick={() => { setDocsJobId(job.id); setDocsJobTitle(job.title); }}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-50 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors font-medium mt-1 mb-2"
                  >
                    📎 Docs
                  </button>
                )}

                {["enquired", "confirmed"].includes(booking.status) && (
                  <button
                    onClick={() => cancelMutation.mutate(booking.id)}
                    className="text-sm text-gray-400 hover:text-red-600 transition-colors mt-2"
                  >
                    Cancel this booking
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {docsJobId !== null && (
        <JobDocumentsModal
          jobId={docsJobId}
          jobTitle={docsJobTitle}
          open={docsJobId !== null}
          onClose={() => setDocsJobId(null)}
          isOwner={false}
        />
      )}
    </div>
  );
}
