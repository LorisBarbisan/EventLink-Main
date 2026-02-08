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
  Briefcase,
  Building2,
  Calendar,
  Clock,
  MapPin,
  PoundSterling,
  Send,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "wouter";

export default function JobDetail() {
  const params = useParams<{ id: string }>();
  const jobId = params.id;
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [coverLetter, setCoverLetter] = useState("");
  const [showApplyForm, setShowApplyForm] = useState(false);

  useEffect(() => {
    fetch(`/api/jobs/${jobId}/link-view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "direct" }),
    }).catch(() => {});
  }, [jobId]);

  const { data: job, isLoading, error } = useQuery<Job>({
    queryKey: ["/api/jobs", jobId],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load job");
      }
      return res.json();
    },
  });

  const { data: existingApplication } = useQuery({
    queryKey: ["/api/applications/check", jobId],
    queryFn: async () => {
      if (!user || user.role !== "freelancer") return null;
      const res = await fetch(`/api/applications/freelancer/${user.id}`);
      if (!res.ok) return null;
      const apps = await res.json();
      return apps.find((a: any) => a.job_id === parseInt(jobId!));
    },
    enabled: !!user && user.role === "freelancer",
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: parseInt(jobId!),
          freelancer_id: user!.id,
          cover_letter: coverLetter || undefined,
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Application submitted", description: "Your application has been sent to the recruiter." });
      setShowApplyForm(false);
      setCoverLetter("");
      queryClient.invalidateQueries({ queryKey: ["/api/applications/check", jobId] });
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
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-6 w-48 mb-6" />
          <Skeleton className="h-40 w-full mb-4" />
          <Skeleton className="h-32 w-full" />
        </div>
      </Layout>
    );
  }

  if (error || !job) {
    const errorMessage = error?.message || "Job not found";
    const isNotAvailable = errorMessage.includes("not found") || errorMessage.includes("not available");

    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">
            {isNotAvailable ? "Job Not Available" : "Something went wrong"}
          </h1>
          <p className="text-muted-foreground mb-6">
            {isNotAvailable
              ? "This job is no longer available or has been removed from EventLink."
              : "We couldn't load this job. Please try again later."}
          </p>
          <div className="flex gap-3 justify-center">
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
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Applications Closed</h1>
          <p className="text-muted-foreground mb-2">{job.title} at {job.company}</p>
          <p className="text-muted-foreground mb-6">This job is no longer accepting applications.</p>
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
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="sm" onClick={() => window.history.length > 1 ? window.history.back() : setLocation("/jobs")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">
                    EventLink Opportunity
                  </Badge>
                  {job.status === "active" && (
                    <Badge variant="outline" className="text-green-700 border-green-300">
                      Open
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-2xl mt-2">{job.title}</CardTitle>
                <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span className="font-medium">{job.company}</span>
                </div>
              </div>
              <ShareJobButton job={job} />
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span>{job.location}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <PoundSterling className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span>{job.rate}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Briefcase className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="capitalize">{job.type}</span>
              </div>
              {job.event_date && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span>
                    {job.event_date}
                    {job.end_date ? ` - ${job.end_date}` : ""}
                  </span>
                </div>
              )}
              {duration && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span>{duration}</span>
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-2">Description</h3>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {job.description}
              </div>
            </div>

            <div className="border-t pt-6">
              {!user ? (
                <div className="text-center space-y-3">
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
                    <Badge variant="outline" className="text-green-700 border-green-300 py-2 px-4 text-sm">
                      You have already applied for this job
                    </Badge>
                  </div>
                ) : showApplyForm ? (
                  <div className="space-y-4">
                    <h3 className="font-semibold">Apply for this job</h3>
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">Cover letter (optional)</label>
                      <Textarea
                        placeholder="Tell the recruiter why you're a great fit..."
                        value={coverLetter}
                        onChange={(e) => setCoverLetter(e.target.value)}
                        rows={4}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => applyMutation.mutate()}
                        disabled={applyMutation.isPending}
                        className="bg-orange-600 hover:bg-orange-700"
                      >
                        <Send className="h-4 w-4 mr-1" />
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
                <p className="text-sm text-muted-foreground text-center">
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
