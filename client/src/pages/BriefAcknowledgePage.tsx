import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { format } from "date-fns";
import { CheckCircle2, Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface BriefAttachment {
  id: number;
  originalFilename: string;
  fileType: string;
  fileSize: number;
  downloadUrl: string;
}

interface BriefDetail {
  id: number;
  status: "sent" | "acknowledged";
  eventTitle: string;
  eventDate: string;
  callTime?: string | null;
  venueAddress?: string | null;
  roleRequired?: string | null;
  agreedRate?: string | null;
  dresscode?: string | null;
  parkingInfo?: string | null;
  contactOnDay?: string | null;
  scheduleNotes?: string | null;
  details?: string | null;
  acknowledgedAt?: string | null;
  attachments: BriefAttachment[];
}

interface BriefResponse {
  brief: BriefDetail;
  employerName: string;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm font-medium text-gray-500">{label}</span>
      <span className="col-span-2 text-sm text-gray-900">{value}</span>
    </div>
  );
}

export default function BriefAcknowledgePage() {
  const [, params] = useRoute("/brief/acknowledge/:token");
  const token = params?.token ?? "";
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const { data, isLoading, isError } = useQuery<BriefResponse>({
    queryKey: ["/api/briefs/acknowledge", token],
    queryFn: () => apiRequest(`/api/briefs/acknowledge/${token}`),
    enabled: !!token,
    retry: false,
  });

  const ackMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/briefs/acknowledge/${token}`, {
        method: "POST",
        body: JSON.stringify({ note: note.trim() || undefined }),
      }),
    onSuccess: () => setConfirmed(true),
  });

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Not found
  if (isError || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <FileText className="h-12 w-12 text-gray-300 mb-4" />
        <h1 className="text-xl font-semibold text-gray-700 mb-2">Brief not found</h1>
        <p className="text-gray-500 text-sm">This brief link is invalid or has expired.</p>
      </div>
    );
  }

  const { brief, employerName } = data;

  // Already acknowledged (before user submits this session)
  if (brief.status === "acknowledged" && !confirmed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Already acknowledged</h1>
        <p className="text-gray-500 mb-2">You have already acknowledged this brief.</p>
        {brief.acknowledgedAt && (
          <p className="text-sm text-gray-400">
            Acknowledged on {format(new Date(brief.acknowledgedAt), "d MMMM yyyy 'at' HH:mm")}
          </p>
        )}
      </div>
    );
  }

  // Successfully confirmed this session
  if (confirmed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Brief acknowledged</h1>
        <p className="text-gray-500 mb-1">{employerName} has been notified.</p>
        <p className="text-sm text-gray-400">You can close this page.</p>
        <div className="mt-8 text-xs text-gray-300">EventLink — The UK Events Industry Network</div>
      </div>
    );
  }

  // Pending — show brief and acknowledgement form
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1E3A5F] py-6 text-center">
        <h1 className="text-white text-2xl font-bold">EventLink</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">Job Brief from {employerName}</h2>
          <p className="text-gray-500 text-sm mt-1">Please read carefully and confirm you have understood it.</p>
        </div>

        {/* Core details card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Event Details</h3>
          </div>
          <div className="px-5 py-1">
            <DetailRow label="Event" value={brief.eventTitle} />
            <DetailRow label="Date" value={brief.eventDate} />
            {brief.callTime && <DetailRow label="Call time" value={brief.callTime} />}
            {brief.venueAddress && <DetailRow label="Venue" value={brief.venueAddress} />}
            {brief.roleRequired && <DetailRow label="Role" value={brief.roleRequired} />}
            {brief.agreedRate && <DetailRow label="Rate" value={brief.agreedRate} />}
          </div>
        </div>

        {/* Dress code */}
        {brief.dresscode && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Dress Code</h3>
            <p className="text-sm text-gray-600">{brief.dresscode}</p>
          </div>
        )}

        {/* Parking */}
        {brief.parkingInfo && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Parking</h3>
            <p className="text-sm text-gray-600">{brief.parkingInfo}</p>
          </div>
        )}

        {/* Contact on the day */}
        {brief.contactOnDay && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Contact on the Day</h3>
            <p className="text-sm text-gray-600">{brief.contactOnDay}</p>
          </div>
        )}

        {/* Schedule */}
        {brief.scheduleNotes && (
          <div className="bg-blue-50 rounded-xl border border-blue-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">Schedule / Running Order</h3>
            <p className="text-sm text-blue-700 whitespace-pre-line">{brief.scheduleNotes}</p>
          </div>
        )}

        {/* Additional info */}
        {brief.details && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Additional Information</h3>
            <p className="text-sm text-gray-600 whitespace-pre-line">{brief.details}</p>
          </div>
        )}

        {/* Attachments */}
        {brief.attachments.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Attachments</h3>
            </div>
            <div className="px-5 py-3 space-y-2">
              {brief.attachments.map((att) => (
                <a
                  key={att.id}
                  href={att.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-sm text-orange-600 hover:text-orange-700 hover:underline"
                >
                  <Download className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 truncate">{att.originalFilename}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">{formatBytes(att.fileSize)}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Acknowledgement form */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="note" className="text-sm text-gray-600">
              Add a message (optional)
            </Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="e.g. See you there! / I have a question about…"
            />
          </div>
          <Button
            onClick={() => ackMutation.mutate()}
            disabled={ackMutation.isPending}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-base font-semibold"
          >
            {ackMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Confirming…</>
            ) : (
              "I have read and understood this brief"
            )}
          </Button>
        </div>

        <div className="text-center text-xs text-gray-400 pb-8">
          EventLink — The UK Events Industry Network
        </div>
      </div>
    </div>
  );
}
