import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

export interface JobDetailResponse {
  job: {
    id: number;
    title: string;
    company: string;
    location: string;
    rate: string;
    description: string;
    status: string;
    event_date?: string;
    end_date?: string;
    start_time?: string;
    end_time?: string;
    duration_type?: string;
    days?: number;
    hours?: number;
    created_at: string;
    application_count: number;
    hired_count: number;
  };
  applications: Array<{
    id: number;
    freelancer_id: number;
    status: string;
    applied_at: string;
    freelancer_name: string;
    freelancer_email: string;
    freelancer_title?: string | null;
  }>;
}

/**
 * The job detail panel used in the employer My Jobs tab (job info + applications
 * table). Extracted so it can be reused inside other dialogs (e.g. the crew
 * member preview). Renders the body only — the caller provides the dialog shell.
 */
export function JobDetailPanel({ jobId }: { jobId: number | null }) {
  const { data: jobDetailData, isLoading: jobDetailLoading } = useQuery<JobDetailResponse>({
    queryKey: ["/api/jobs", jobId, "detail"],
    queryFn: () => apiRequest(`/api/jobs/${jobId}/detail`),
    enabled: jobId !== null,
  });

  if (jobDetailLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!jobDetailData) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">{jobDetailData.job.title || "Job Details"}</h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Company</p>
          <p className="font-medium">{jobDetailData.job.company}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Location</p>
          <p className="font-medium">{jobDetailData.job.location}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Rate</p>
          <p className="font-medium">{jobDetailData.job.rate}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Status</p>
          <Badge
            variant={
              jobDetailData.job.status === "active"
                ? "default"
                : jobDetailData.job.status === "closed"
                  ? "destructive"
                  : "outline"
            }
            className={
              jobDetailData.job.status === "active" ? "bg-green-600 hover:bg-green-700" : ""
            }
          >
            {jobDetailData.job.status === "active"
              ? "Posted"
              : jobDetailData.job.status === "private"
                ? "Unposted"
                : jobDetailData.job.status}
          </Badge>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Event Date</p>
          <p className="font-medium">
            {jobDetailData.job.event_date || "Not set"}
            {jobDetailData.job.end_date ? ` - ${jobDetailData.job.end_date}` : ""}
          </p>
        </div>
        {jobDetailData.job.start_time && (
          <div>
            <p className="text-sm text-muted-foreground">Time</p>
            <p className="font-medium">
              {jobDetailData.job.start_time}
              {jobDetailData.job.end_time ? ` - ${jobDetailData.job.end_time}` : ""}
            </p>
          </div>
        )}
        {jobDetailData.job.duration_type === "days" && jobDetailData.job.days && (
          <div>
            <p className="text-sm text-muted-foreground">Duration</p>
            <p className="font-medium">{jobDetailData.job.days} days</p>
          </div>
        )}
        {jobDetailData.job.duration_type === "hours" && jobDetailData.job.hours && (
          <div>
            <p className="text-sm text-muted-foreground">Duration</p>
            <p className="font-medium">{jobDetailData.job.hours} hours</p>
          </div>
        )}
        <div>
          <p className="text-sm text-muted-foreground">Created</p>
          <p className="font-medium">
            {new Date(jobDetailData.job.created_at).toLocaleDateString("en-GB")}
          </p>
        </div>
      </div>

      {jobDetailData.job.description && (
        <div>
          <p className="mb-1 text-sm text-muted-foreground">Description</p>
          <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">
            {jobDetailData.job.description}
          </p>
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center gap-3">
          <h3 className="font-semibold">Applications</h3>
          <Badge variant="secondary">{jobDetailData.job.application_count} total</Badge>
          {jobDetailData.job.hired_count > 0 && (
            <Badge className="bg-green-600 hover:bg-green-700">
              {jobDetailData.job.hired_count} hired
            </Badge>
          )}
        </div>
        {jobDetailData.applications.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Freelancer</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead>Profile</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobDetailData.applications.map((app) => (
                  <TableRow
                    key={app.id}
                    className={app.status === "hired" ? "bg-green-50 dark:bg-green-950/20" : ""}
                  >
                    <TableCell className="py-2">
                      <p className="text-sm font-medium">{app.freelancer_name}</p>
                      <a
                        href={`/profile/${app.freelancer_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {app.freelancer_email}
                      </a>
                    </TableCell>
                    <TableCell className="py-2 text-sm">{app.freelancer_title || "-"}</TableCell>
                    <TableCell className="py-2">
                      <Badge
                        variant={
                          app.status === "hired"
                            ? "default"
                            : app.status === "rejected"
                              ? "destructive"
                              : "secondary"
                        }
                        className={app.status === "hired" ? "bg-green-600 hover:bg-green-700" : ""}
                      >
                        {app.status === "rejected"
                          ? "Declined"
                          : app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 text-xs">
                      {new Date(app.applied_at).toLocaleDateString("en-GB")}
                    </TableCell>
                    <TableCell className="py-2">
                      <a
                        href={`/profile/${app.freelancer_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View Profile
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No applications yet.</p>
        )}
      </div>
    </div>
  );
}
