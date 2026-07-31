import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Banknote,
  BookmarkPlus,
  Calendar,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  MapPin,
  Plus,
  RotateCcw,
  Trash2,
  UserCheck,
  UserX,
  XCircle,
} from "lucide-react";
import type { Job } from "@shared/types";

interface Applicant {
  id: number;
  freelancer_id: number;
  status: string;
  applied_at: string;
  cover_letter?: string;
  freelancer_name: string;
  freelancer_email: string;
  freelancer_title?: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: "Live", color: "text-green-700", bg: "bg-green-100" },
  private: { label: "Draft", color: "text-gray-600", bg: "bg-gray-100" },
  paused: { label: "Paused", color: "text-amber-700", bg: "bg-amber-100" },
  closed: { label: "Closed", color: "text-red-600", bg: "bg-red-100" },
};

interface PostJobFormData {
  title: string;
  location: string;
  type: string;
  rate: string;
  description: string;
  event_date: string;
  company: string;
}

const EMPTY_FORM: PostJobFormData = {
  title: "",
  location: "",
  type: "freelance",
  rate: "",
  description: "",
  event_date: "",
  company: "",
};

export default function MyPostedJobs() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [form, setForm] = useState<PostJobFormData>(EMPTY_FORM);
  const [expandedJobId, setExpandedJobId] = useState<number | null>(null);

  const { data: postedJobs, isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs/my-posted"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: PostJobFormData) =>
      apiRequest("/api/jobs/freelancer", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/my-posted"] });
      toast({
        title: "Job posted",
        description: "Your job is saved as a draft. Publish it when ready.",
      });
      setDialogOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (err: any) => {
      toast({
        title: "Failed to post job",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ jobId, data }: { jobId: number; data: Partial<PostJobFormData> }) =>
      apiRequest(`/api/jobs/${jobId}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/my-posted"] });
      toast({ title: "Job updated" });
      setDialogOpen(false);
      setEditingJob(null);
      setForm(EMPTY_FORM);
    },
    onError: (err: any) => {
      toast({
        title: "Failed to update job",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (jobId: number) =>
      apiRequest(`/api/jobs/${jobId}`, {
        method: "PUT",
        body: JSON.stringify({ status: "active" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/my-posted"] });
      toast({ title: "Job published", description: "Your job is now live on Find Jobs." });
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: async (jobId: number) =>
      apiRequest(`/api/jobs/${jobId}`, {
        method: "PUT",
        body: JSON.stringify({ status: "private" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/my-posted"] });
      toast({ title: "Job unpublished", description: "Your job has been set back to draft." });
    },
  });

  const closeMutation = useMutation({
    mutationFn: async (jobId: number) => apiRequest(`/api/jobs/${jobId}/close`, { method: "PUT" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/my-posted"] });
      toast({ title: "Job closed" });
    },
  });

  const reopenMutation = useMutation({
    mutationFn: async (jobId: number) => apiRequest(`/api/jobs/${jobId}/reopen`, { method: "PUT" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/my-posted"] });
      toast({
        title: "Job reopened",
        description: "Your job is now a draft. Publish it when ready.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (jobId: number) => apiRequest(`/api/jobs/${jobId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/my-posted"] });
      toast({ title: "Job deleted" });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (applicationId: number) =>
      apiRequest(`/api/applications/${applicationId}/accept`, { method: "PUT" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${expandedJobId}/applications`] });
      toast({ title: "Applicant accepted" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to accept", description: err?.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (applicationId: number) =>
      apiRequest(`/api/applications/${applicationId}/reject`, { method: "PUT" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${expandedJobId}/applications`] });
      toast({ title: "Applicant declined" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to decline", description: err?.message, variant: "destructive" });
    },
  });

  const shortlistMutation = useMutation({
    mutationFn: async (applicationId: number) =>
      apiRequest(`/api/applications/${applicationId}/shortlist`, { method: "PUT" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${expandedJobId}/applications`] });
      toast({ title: "Applicant shortlisted" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to shortlist", description: err?.message, variant: "destructive" });
    },
  });

  const openCreate = () => {
    setEditingJob(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (job: Job) => {
    setEditingJob(job);
    setForm({
      title: job.title,
      location: job.location,
      type: job.type,
      rate: job.rate,
      description: job.description,
      event_date: job.event_date || "",
      company: job.company,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingJob) {
      updateMutation.mutate({ jobId: editingJob.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jobs I&apos;ve Posted</h1>
          <p className="mt-1 text-gray-500">Post crew calls and event opportunities</p>
        </div>
        <Button onClick={openCreate} className="flex-shrink-0 gap-2">
          <Plus className="h-4 w-4" />
          Post a Job
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : !postedJobs?.length ? (
        <div className="py-16 text-center">
          <div className="mb-4 text-5xl">📋</div>
          <h3 className="mb-2 text-lg font-medium text-gray-900">No jobs posted yet</h3>
          <p className="mb-6 text-sm text-gray-500">
            Post a crew call or event opportunity to find the right people.
          </p>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Post your first job
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {postedJobs.map((job) => {
            const statusCfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.private;
            return (
              <div
                key={job.id}
                className="rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <button
                    onClick={() => openEdit(job)}
                    className="text-left font-semibold text-gray-900 hover:text-primary"
                  >
                    {job.title}
                  </button>
                  <span
                    className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusCfg.bg} ${statusCfg.color}`}
                  >
                    {statusCfg.label}
                  </span>
                </div>

                <div className="mb-3 flex flex-wrap gap-3 text-sm text-gray-500">
                  {job.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {job.location}
                    </span>
                  )}
                  {job.rate && (
                    <span className="flex items-center gap-1">
                      <Banknote className="h-3.5 w-3.5" />
                      {job.rate}
                    </span>
                  )}
                  {job.event_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(job.event_date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {job.status === "private" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs"
                      onClick={() => publishMutation.mutate(job.id)}
                      disabled={publishMutation.isPending}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Publish
                    </Button>
                  )}
                  {job.status === "active" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs"
                      onClick={() => unpublishMutation.mutate(job.id)}
                      disabled={unpublishMutation.isPending}
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                      Unpublish
                    </Button>
                  )}
                  {job.status !== "closed" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs"
                        onClick={() => openEdit(job)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs text-red-600 hover:bg-red-50"
                        onClick={() => closeMutation.mutate(job.id)}
                        disabled={closeMutation.isPending}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Close
                      </Button>
                    </>
                  )}
                  {job.status === "closed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs"
                      onClick={() => reopenMutation.mutate(job.id)}
                      disabled={reopenMutation.isPending}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reopen
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this job?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently remove &quot;{job.title}&quot; and notify any
                          applicants. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-700"
                          onClick={() => deleteMutation.mutate(job.id)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                {/* Applicants toggle */}
                <button
                  onClick={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}
                  className="mt-3 flex w-full items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
                >
                  <span>Applicants</span>
                  {expandedJobId === job.id ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>

                {expandedJobId === job.id && (
                  <ApplicantsPanel
                    jobId={job.id}
                    onAccept={(id) => acceptMutation.mutate(id)}
                    onReject={(id) => rejectMutation.mutate(id)}
                    onShortlist={(id) => shortlistMutation.mutate(id)}
                    isPending={
                      acceptMutation.isPending ||
                      rejectMutation.isPending ||
                      shortlistMutation.isPending
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Post / Edit Job Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingJob(null);
            setForm(EMPTY_FORM);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingJob ? "Edit Job" : "Post a Job"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="title">Job title *</Label>
              <Input
                id="title"
                placeholder="e.g. Sound Engineer needed for wedding"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="company">
                Event / company name{" "}
                <span className="font-normal text-gray-400">
                  (optional — defaults to your name)
                </span>
              </Label>
              <Input
                id="company"
                placeholder="e.g. The Grand Wedding Co"
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="location">Location *</Label>
                <Input
                  id="location"
                  placeholder="e.g. London"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rate">Rate *</Label>
                <Input
                  id="rate"
                  placeholder="e.g. £200/day"
                  value={form.rate}
                  onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="type">Job type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="freelance">Freelance</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="part-time">Part-time</SelectItem>
                    <SelectItem value="full-time">Full-time</SelectItem>
                    <SelectItem value="temporary">Temporary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event_date">Event date</Label>
                <Input
                  id="event_date"
                  type="date"
                  value={form.event_date}
                  onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the role, requirements, and what you're looking for..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={5}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : editingJob ? "Save changes" : "Save as draft"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const APP_STATUS: Record<string, { label: string; color: string }> = {
  applied: { label: "Applied", color: "text-blue-600" },
  reviewed: { label: "Reviewed", color: "text-amber-600" },
  shortlisted: { label: "Shortlisted", color: "text-purple-600" },
  hired: { label: "Accepted", color: "text-green-700" },
  rejected: { label: "Declined", color: "text-red-500" },
  invited: { label: "Invited", color: "text-indigo-600" },
};

function ApplicantsPanel({
  jobId,
  onAccept,
  onReject,
  onShortlist,
  isPending,
}: {
  jobId: number;
  onAccept: (id: number) => void;
  onReject: (id: number) => void;
  onShortlist: (id: number) => void;
  isPending: boolean;
}) {
  const [expandedCoverId, setExpandedCoverId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<Applicant[]>({
    queryKey: [`/api/jobs/${jobId}/applications`],
  });

  if (isLoading) {
    return <div className="mt-3 py-4 text-center text-sm text-gray-400">Loading applicants…</div>;
  }

  if (!data?.length) {
    return (
      <div className="mt-3 rounded-lg bg-gray-50 py-6 text-center text-sm text-gray-400">
        No applications yet
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {data.map((app) => {
        const cfg = APP_STATUS[app.status] ?? { label: app.status, color: "text-gray-500" };
        const canAct = ["applied", "reviewed"].includes(app.status);
        const canAccept = ["applied", "reviewed", "shortlisted"].includes(app.status);
        const coverExpanded = expandedCoverId === app.id;
        return (
          <div key={app.id} className="rounded-lg border border-gray-100 bg-white px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <a
                  href={`/profile/${app.freelancer_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-gray-900 hover:text-primary hover:underline"
                >
                  {app.freelancer_name}
                </a>
                {app.freelancer_title && (
                  <p className="truncate text-xs text-gray-400">{app.freelancer_title}</p>
                )}
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                {app.cover_letter && (
                  <button
                    onClick={() => setExpandedCoverId(coverExpanded ? null : app.id)}
                    title={coverExpanded ? "Hide cover letter" : "View cover letter"}
                    className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
                  >
                    {coverExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                )}
                {canAct && (
                  <button
                    onClick={() => onShortlist(app.id)}
                    disabled={isPending}
                    title="Shortlist"
                    className="rounded p-1 text-purple-600 transition-colors hover:bg-purple-50 disabled:opacity-40"
                  >
                    <BookmarkPlus className="h-4 w-4" />
                  </button>
                )}
                {canAccept && (
                  <button
                    onClick={() => onAccept(app.id)}
                    disabled={isPending}
                    title="Accept"
                    className="rounded p-1 text-green-600 transition-colors hover:bg-green-50 disabled:opacity-40"
                  >
                    <UserCheck className="h-4 w-4" />
                  </button>
                )}
                {(canAct || app.status === "shortlisted") && (
                  <button
                    onClick={() => onReject(app.id)}
                    disabled={isPending}
                    title="Decline"
                    className="rounded p-1 text-red-500 transition-colors hover:bg-red-50 disabled:opacity-40"
                  >
                    <UserX className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            {coverExpanded && app.cover_letter && (
              <p className="mt-2 whitespace-pre-wrap rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">
                {app.cover_letter}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
