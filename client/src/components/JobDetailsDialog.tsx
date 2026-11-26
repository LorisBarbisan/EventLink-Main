import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Download } from "lucide-react";
import type { Job } from "@shared/schema";

interface JobDoc {
  id: number;
  fileName: string;
  downloadUrl: string;
  documentType?: string;
}

// Download with the auth header, falling back to opening the URL in a new tab.
async function downloadDoc(doc: JobDoc) {
  try {
    const token = localStorage.getItem("auth_token");
    const res = await fetch(doc.downloadUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Download failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.fileName;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    window.open(doc.downloadUrl, "_blank");
  }
}

/**
 * Read-only job details for a freelancer, fetched from /api/jobs/:id (which a
 * booking holder can access, including a private direct-offer job). Used from
 * the Bookings cards' "View details" button, mirroring My Applications. Also
 * lists the job's attachments as clickable downloads.
 */
export function JobDetailsDialog({
  jobId,
  open,
  onOpenChange,
}: {
  jobId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const {
    data: job,
    isLoading,
    isError,
  } = useQuery<Job>({
    queryKey: ["/api/jobs", jobId],
    queryFn: () => apiRequest(`/api/jobs/${jobId}`),
    enabled: open && jobId !== null,
  });

  const { data: docs = [] } = useQuery<JobDoc[]>({
    queryKey: [`/api/job/${jobId}/documents`],
    queryFn: () => apiRequest(`/api/job/${jobId}/documents`),
    enabled: open && jobId !== null,
  });

  const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Job details</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        ) : isError || !job ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Couldn&rsquo;t load this job.
          </p>
        ) : (
          <div className="space-y-5">
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-xs font-medium text-muted-foreground">Job title</p>
              <p className="text-lg font-bold">{job.title}</p>
              {job.company && <p className="mt-0.5 text-sm text-muted-foreground">{job.company}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Location</p>
                <p className="font-medium">{job.location || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="font-medium">{fmtDate(job.event_date)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rate</p>
                <p className="font-medium">{job.rate || "—"}</p>
              </div>
              {(job.start_time || job.end_time) && (
                <div>
                  <p className="text-xs text-muted-foreground">Times</p>
                  <p className="font-medium">
                    {[job.start_time, job.end_time].filter(Boolean).join(" – ") || "—"}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="font-medium capitalize">{job.status || "—"}</p>
              </div>
            </div>

            {job.description && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Description</p>
                <div className="max-h-56 overflow-y-auto rounded-lg bg-muted p-3">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{job.description}</p>
                </div>
              </div>
            )}

            <div>
              <p className="mb-1 text-xs text-muted-foreground">Attachments</p>
              {docs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No attachments.</p>
              ) : (
                <div className="space-y-2">
                  {docs.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => downloadDoc(doc)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-orange-500" />
                        <span className="truncate text-sm font-medium">{doc.fileName}</span>
                      </span>
                      <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
