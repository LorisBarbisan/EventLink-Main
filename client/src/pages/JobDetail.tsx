import { Layout } from "@/components/Layout";
import { ShareJobButton } from "@/components/ShareJobButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import type { Job } from "@shared/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  Building2,
  Calendar,
  Clock,
  Lock,
  MapPin,
  Send,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "wouter";

export default function JobDetail() {
  const params = useParams<{ id: string }>();
  const jobId = params.id;
  const isSlug = jobId ? isNaN(Number(jobId)) : false;
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [coverLetter, setCoverLetter] = useState("");
  const [showApplyForm, setShowApplyForm] = useState(false);

  const {
    data: job,
    isLoading,
    error,
  } = useQuery<Job>({
    queryKey: ["/api/jobs", jobId],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      const token = localStorage.getItem("auth_token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      let res: Response;
      if (isSlug) {
        res = await fetch(`/api/jobs/by-slug/${jobId}`, { headers });
      } else {
        res = await fetch(`/api/jobs/${jobId}`, { headers });
      }
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load job");
      }
      const jobData = await res.json();
      if (isSlug) {
        fetch(`/api/jobs/${jobData.id}/link-view`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "direct" }),
        }).catch(() => {});
      }
      return jobData;
    },
  });

  useEffect(() => {
    if (!isSlug && jobId) {
      fetch(`/api/jobs/${jobId}/link-view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "direct" }),
      }).catch(() => {});
    }
  }, [jobId, isSlug]);

  const { data: existingApplication } = useQuery({
    queryKey: ["/api/applications/check", job?.id],
    queryFn: async () => {
      if (!user || user.role !== "freelancer" || !job?.id) return null;
      const res = await fetch(`/api/freelancer/${user.id}/applications`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
      });
      if (!res.ok) return null;
      const apps = await res.json();
      return apps.find((a: { job_id: number }) => a.job_id === job.id);
    },
    enabled: !!user && user.role === "freelancer" && !!job?.id,
  });

  const applyMutation = useMutation({
    mutationFn: async (numericJobId: number) => {
      return await apiRequest(`/api/jobs/${numericJobId}/apply`, {
        method: "POST",
        body: JSON.stringify({
          cover_letter: coverLetter || undefined,
        }),
      });
    },
    onSuccess: (_, numericJobId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications/check", numericJobId] });
      setLocation(`/application-success/${numericJobId}`);
    },
    onError: (err: Error) => {
      toast({ title: "Application failed", description: err.message, variant: "destructive" });
    },
  });

  const formatDuration = (job: Job): string | null => {
    if (!job.duration_type) return null;
    if (job.duration_type === "time" && job.start_time && job.end_time) {
      return `${job.start_time} - ${job.end_time}`;
    }
    if (job.duration_type === "days" && job.days) {
      return `${job.days} day${job.days > 1 ? "s" : ""}`;
    }
    if (job.duration_type === "hours" && job.hours) {
      return `${job.hours} hour${job.hours > 1 ? "s" : ""}`;
    }
    return null;
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="mx-auto max-w-3xl px-4 py-8">
          <Skeleton className="mb-4 h-8 w-64" />
          <Skeleton className="mb-6 h-6 w-48" />
          <Skeleton className="mb-4 h-40 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </Layout>
    );
  }

  if (error || !job) {
    const errorMessage = error?.message || "Job not found";
    const isInviteOnly = errorMessage.includes("invitation");
    const isNotAvailable =
      errorMessage.includes("not found") || errorMessage.includes("not available");

    return (
      <Layout>
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          {isInviteOnly ? (
            <Lock className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
          ) : (
            <AlertCircle className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
          )}
          <h1 className="mb-2 text-2xl font-bold">
            {isInviteOnly
              ? "Invite Only"
              : isNotAvailable
                ? "Job Not Available"
                : "Something went wrong"}
          </h1>
          <p className="mb-6 text-muted-foreground">
            {isInviteOnly
              ? errorMessage
              : isNotAvailable
                ? "This job is no longer available or has been removed from EventLink."
                : "We couldn't load this job. Please try again later."}
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/jobs">
              <Button>Browse Jobs</Button>
            </Link>
            <Link href="/">
              <Button variant="outline">Go Home</Button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  if (job.status === "closed") {
    return (
      <Layout>
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <XCircle className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
          <h1 className="mb-2 text-2xl font-bold">Job Closed</h1>
          <p className="mb-2 text-muted-foreground">
            {job.title} at {job.company}
          </p>
          <p className="mb-6 text-muted-foreground">
            This job is no longer accepting applications.
          </p>
          <Link href="/jobs">
            <Button>Browse Other Jobs</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const isFreelancer = user?.role === "freelancer";
  const hasApplied = !!existingApplication;
  const isExternalJob = job.type === "external" && job.external_url;
  const duration = formatDuration(job);

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              window.history.length > 1 ? window.history.back() : setLocation("/jobs")
            }
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="border-orange-200 bg-orange-100 text-orange-800"
                  >
                    EventLink Opportunity
                  </Badge>
                  {job.status === "active" && (
                    <Badge variant="outline" className="border-green-300 text-green-700">
                      Open
                    </Badge>
                  )}
                  {job.status === "private" && (
                    <Badge variant="outline" className="border-amber-300 text-amber-700">
                      <Lock className="mr-1 h-3 w-3" />
                      Invite Only
                    </Badge>
                  )}
                </div>
                <CardTitle className="mt-2 text-2xl">{job.title}</CardTitle>
                <div className="mt-1 flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span className="font-medium">{job.company}</span>
                </div>
              </div>
              <ShareJobButton job={job} />
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span>{job.location}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Banknote className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span>{job.rate}</span>
              </div>
              {job.event_date && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <span>
                    {job.event_date}
                    {job.end_date ? ` - ${job.end_date}` : ""}
                  </span>
                </div>
              )}
              {duration && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <span>{duration}</span>
                </div>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-lg font-semibold">Description</h3>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {job.description}
              </div>
            </div>

            <div className="border-t pt-6">
              {!user ? (
                <div className="space-y-3 text-center">
                  <p className="text-muted-foreground">Sign in to apply for this job</p>
                  <Link href={`/auth?redirect=/jobs/${job.id}`}>
                    <Button size="lg" className="bg-orange-600 hover:bg-orange-700">
                      Sign In to Apply
                    </Button>
                  </Link>
                </div>
              ) : isExternalJob ? (
                <a href={job.external_url!} target="_blank" rel="noopener noreferrer">
                  <Button size="lg" className="w-full sm:w-auto">
                    Apply on {job.external_source || "External Site"}
                  </Button>
                </a>
              ) : isFreelancer ? (
                hasApplied ? (
                  <div className="text-center">
                    <Badge
                      variant="outline"
                      className="border-green-300 px-4 py-2 text-sm text-green-700"
                    >
                      You have already applied for this job
                    </Badge>
                  </div>
                ) : showApplyForm ? (
                  <div className="space-y-4">
                    <h3 className="font-semibold">Apply for this job</h3>
                    <div>
                      <label className="mb-1 block text-sm text-muted-foreground">
                        Cover letter (optional)
                      </label>
                      <Textarea
                        placeholder="Tell the employer why you're a great fit..."
                        value={coverLetter}
                        onChange={(e) => setCoverLetter(e.target.value)}
                        rows={4}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => applyMutation.mutate(job.id)}
                        disabled={applyMutation.isPending}
                        className="bg-orange-600 hover:bg-orange-700"
                      >
                        <Send className="mr-1 h-4 w-4" />
                        {applyMutation.isPending ? "Submitting..." : "Submit Application"}
                      </Button>
                      <Button variant="outline" onClick={() => setShowApplyForm(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="lg"
                    className="bg-orange-600 hover:bg-orange-700"
                    onClick={() => setShowApplyForm(true)}
                  >
                    Apply on EventLink
                  </Button>
                )
              ) : (
                <p className="text-center text-sm text-muted-foreground">
                  Only freelancers can apply for jobs.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
