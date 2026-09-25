// ============================================================
// FMS Phase 1 — My Jobs Page (Freelancer Dashboard)
// File: client/src/pages/freelancer/MyJobs.tsx
// ============================================================

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { JobDocumentsModal } from "@/components/JobDocumentsModal";
import { useToast } from "@/hooks/use-toast";

type BookingStatus = "enquired" | "confirmed" | "briefed" | "completed" | "cancelled";

interface FreelancerBookingResult {
  booking: {
    id: number;
    status: BookingStatus;
    agreedRate: string | null;
    currency: string | null;
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
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState<BookingStatus | "all">("all");

  // Docs modal state
  const [docsJobId, setDocsJobId] = useState<number | null>(null);
  const [docsJobTitle, setDocsJobTitle] = useState<string>("");

  // Upload state (freelancer uploading their own docs)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showUploadWarning, setShowUploadWarning] = useState(false);
  const [docType, setDocType] = useState("invoice");
  const [customDocName, setCustomDocName] = useState("");

  const { data: bookings, isLoading } = useQuery<FreelancerBookingResult[]>({
    queryKey: ["/api/bookings/freelancer"],
  });

  const cancelMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      return apiRequest(`/api/bookings/${bookingId}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "cancelled",
          cancellationReason: "Cancelled by freelancer",
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/freelancer"] });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 10 MB.",
        variant: "destructive",
      });
      return;
    }
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (!allowed.includes(file.type)) {
      toast({
        title: "File type not supported",
        description: "Only PDF, Word, and Excel files are allowed.",
        variant: "destructive",
      });
      return;
    }
    setPendingFile(file);
    setShowUploadWarning(true);
  };

  const confirmUpload = async () => {
    if (!pendingFile || docsJobId === null) return;
    setShowUploadWarning(false);
    setUploading(true);
    try {
      const effectiveDocType =
        docType === "other" && customDocName.trim() ? customDocName.trim() : docType;
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(pendingFile);
      });
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/job/${docsJobId}/documents/freelancer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          fileData: base64,
          filename: pendingFile.name,
          contentType: pendingFile.type,
          documentType: effectiveDocType,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || `Upload failed (${res.status})`);
      }
      queryClient.invalidateQueries({ queryKey: [`/api/job/${docsJobId}/documents`] });
      toast({ title: "Document uploaded" });
      setCustomDocName("");
      // Re-open the modal after upload
      setTimeout(() => setDocsJobId(docsJobId), 50);
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setPendingFile(null);
    }
  };

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
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Jobs</h1>
        <p className="mt-1 text-gray-500">Jobs you&apos;ve been booked for through EventLink</p>
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1">
        {(["all", "enquired", "confirmed", "briefed", "completed", "cancelled"] as const).map(
          (f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`flex-shrink-0 rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
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
            <div key={i} className="h-32 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <div className="mb-4 text-5xl">📅</div>
          <h3 className="mb-2 text-lg font-medium text-gray-900">No bookings yet</h3>
          <p className="text-sm text-gray-500">
            When an employer books you through EventLink, it will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {upcoming.length > 0 && (
            <h2 className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wide text-orange-600">
              Upcoming
            </h2>
          )}
          {[...upcoming, ...other].map((result) => {
            const { booking, job, employer } = result;
            const statusConfig = STATUS_LABELS[booking.status];
            return (
              <div
                key={booking.id}
                className="rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{job.title}</h3>
                    <p className="text-sm text-gray-500">
                      {job.location}
                      {job.eventDate && (
                        <span className="ml-2 font-medium text-orange-600">
                          · {format(new Date(job.eventDate), "d MMM yyyy")}
                        </span>
                      )}
                    </p>
                  </div>
                  <span
                    className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusConfig.bg} ${statusConfig.color}`}
                  >
                    {statusConfig.label}
                  </span>
                </div>

                {/* Employer info */}
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-7 w-7 flex-shrink-0 overflow-hidden rounded-full bg-gray-100">
                    {employer.profilePicture ? (
                      <img
                        src={employer.profilePicture}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
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
                  <div className="mb-3 flex gap-4 text-sm">
                    {booking.agreedRate && (
                      <div>
                        <span className="text-gray-400">Rate: </span>
                        <span className="font-medium text-gray-900">
                          {booking.currency && booking.currency !== "GBP"
                            ? `${booking.currency} `
                            : ""}
                          {booking.agreedRate}
                        </span>
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
                  <p className="mb-3 text-sm text-gray-500">📍 {booking.venueAddress}</p>
                )}

                {booking.status === "cancelled" && booking.cancellationReason && (
                  <p className="mb-3 text-sm text-red-600">
                    Cancelled: {booking.cancellationReason}
                  </p>
                )}

                {/* Docs button — shown for all non-cancelled bookings */}
                {booking.status !== "cancelled" && (
                  <button
                    onClick={() => {
                      setDocsJobId(job.id);
                      setDocsJobTitle(job.title);
                    }}
                    className="mb-2 mt-1 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100"
                  >
                    📎 Docs
                  </button>
                )}

                {["enquired", "confirmed"].includes(booking.status) && (
                  <button
                    onClick={() => cancelMutation.mutate(booking.id)}
                    className="mt-2 block text-sm text-gray-400 transition-colors hover:text-red-600"
                  >
                    Cancel this booking
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Upload warning / type selector */}
      {showUploadWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
            <div className="mb-4 text-center text-4xl">📋</div>
            <h2 className="mb-3 text-center text-xl font-bold text-gray-900">Before you upload</h2>
            <p className="mb-4 text-center text-sm leading-relaxed text-gray-600">
              This document will be visible to the employer. Make sure you are happy to share it
              before continuing.
            </p>
            {pendingFile && (
              <div className="mb-4 truncate text-center text-xs text-gray-500">
                <span className="font-medium text-gray-700">{pendingFile.name}</span>
                <span className="ml-1">({(pendingFile.size / 1024 / 1024).toFixed(1)} MB)</span>
              </div>
            )}
            <div className="mb-5">
              <label className="mb-2 block text-sm font-medium text-gray-700">Document type</label>
              <select
                value={docType}
                onChange={(e) => {
                  setDocType(e.target.value);
                  setCustomDocName("");
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="invoice">Invoice</option>
                <option value="travel_receipt">Travel Receipt</option>
                <option value="overtime">Overtime</option>
                <option value="other">Other</option>
              </select>
            </div>
            {docType === "other" && (
              <div className="mb-5">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Document name{" "}
                  <span className="font-normal text-gray-400">(e.g. NDA, Timesheet)</span>
                </label>
                <input
                  type="text"
                  value={customDocName}
                  onChange={(e) => setCustomDocName(e.target.value)}
                  placeholder="Enter document name..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  maxLength={60}
                />
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={confirmUpload}
                disabled={uploading}
                className="flex-1 rounded-xl bg-orange-600 py-3 font-semibold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
              <button
                onClick={() => {
                  setShowUploadWarning(false);
                  setPendingFile(null);
                }}
                className="flex-1 rounded-xl border border-gray-300 py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Documents modal */}
      {docsJobId !== null && (
        <JobDocumentsModal
          jobId={docsJobId}
          jobTitle={docsJobTitle}
          open={docsJobId !== null}
          onClose={() => setDocsJobId(null)}
          isOwner={false}
          canUpload={true}
          onAttachFile={() => {
            setDocsJobId(null);
            setTimeout(() => fileInputRef.current?.click(), 0);
          }}
          isUploading={uploading}
        />
      )}
    </div>
  );
}
