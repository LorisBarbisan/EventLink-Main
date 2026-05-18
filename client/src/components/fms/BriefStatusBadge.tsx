import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle2, Clock, FileText } from "lucide-react";
import { SendBriefModal } from "./SendBriefModal";

interface Props {
  bookingId: number;
  bookingStatus: string;
  booking?: any;
  job?: any;
}

interface BriefData {
  id: number;
  status: "sent" | "acknowledged";
  sentAt: string;
  acknowledgedAt?: string | null;
  acknowledgementNote?: string | null;
  eventTitle: string;
  eventDate: string;
}

export function BriefStatusBadge({ bookingId, bookingStatus, booking, job }: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  const { data: brief, isLoading } = useQuery<BriefData>({
    queryKey: ["/api/briefs/booking", bookingId],
    queryFn: () => apiRequest(`/api/briefs/booking/${bookingId}`),
    enabled: ["confirmed", "briefed"].includes(bookingStatus),
    retry: false,
  });

  if (!["confirmed", "briefed"].includes(bookingStatus)) return null;
  if (isLoading) return null;

  // No brief yet — show Send Brief button
  if (!brief) {
    return (
      <>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium border border-orange-400 text-orange-600 rounded-full hover:bg-orange-50 transition-colors"
        >
          <FileText className="h-3 w-3" />
          Send Brief
        </button>
        <SendBriefModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          booking={booking ?? { id: bookingId }}
          job={job}
        />
      </>
    );
  }

  // Brief acknowledged
  if (brief.status === "acknowledged") {
    return (
      <div className="space-y-1">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
          <CheckCircle2 className="h-3 w-3" />
          Brief acknowledged
        </span>
        {brief.acknowledgedAt && (
          <p className="text-xs text-gray-400">
            {format(new Date(brief.acknowledgedAt), "d MMM yyyy 'at' HH:mm")}
          </p>
        )}
        {brief.acknowledgementNote && (
          <p className="text-xs text-gray-500 italic">"{brief.acknowledgementNote}"</p>
        )}
      </div>
    );
  }

  // Brief sent, awaiting acknowledgement
  return (
    <div className="space-y-1">
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
        <Clock className="h-3 w-3" />
        Brief sent — awaiting acknowledgement
      </span>
      {brief.sentAt && (
        <p className="text-xs text-gray-400">
          Sent {format(new Date(brief.sentAt), "d MMM yyyy")}
        </p>
      )}
    </div>
  );
}
