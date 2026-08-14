import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { CountrySelect } from "@/components/ui/country-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GlobalLocationInput } from "@/components/ui/global-location-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  Users,
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

const CURRENCIES = [
  { code: "GBP", symbol: "£", label: "GBP (£)" },
  { code: "USD", symbol: "$", label: "USD ($)" },
  { code: "EUR", symbol: "€", label: "EUR (€)" },
  { code: "AUD", symbol: "A$", label: "AUD (A$)" },
  { code: "CAD", symbol: "C$", label: "CAD (C$)" },
  { code: "ZAR", symbol: "R", label: "ZAR (R)" },
  { code: "SEK", symbol: "kr", label: "SEK (kr)" },
  { code: "NOK", symbol: "kr", label: "NOK (kr)" },
  { code: "DKK", symbol: "kr", label: "DKK (kr)" },
  { code: "JPY", symbol: "¥", label: "JPY (¥)" },
  { code: "AED", symbol: "د.إ", label: "AED (د.إ)" },
];

interface PostJobFormData {
  title: string;
  location: string;
  country: string;
  currency: string;
  rate: string;
  description: string;
  event_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  company: string;
  status?: "active" | "private";
}

const EMPTY_FORM: PostJobFormData = {
  title: "",
  location: "",
  country: "",
  currency: "GBP",
  rate: "",
  description: "",
  event_date: "",
  end_date: "",
  start_time: "",
  end_time: "",
  company: "",
};

export default function MyPostedJobs() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [form, setForm] = useState<PostJobFormData>(EMPTY_FORM);
  const [expandedJobId, setExpandedJobId] = useState<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("openForm") === "1") {
      setEditingJob(null);
      setForm(EMPTY_FORM);
      setDialogOpen(true);
      params.delete("openForm");
      window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
    }
  }, []);

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
      country: job.country || "",
      currency: (job as any).currency || "GBP",
      rate: job.rate,
      description: job.description,
      event_date: job.event_date || "",
      end_date: (job as any).end_date || "",
      start_time: (job as any).start_time || "",
      end_time: (job as any).end_time || "",
      company: job.company,
    });
    setDialogOpen(true);
  };

  const [showAdditional, setShowAdditional] = useState(false);

  const handleSubmit = (status: "private" | "active") => {
    if (editingJob) {
      updateMutation.mutate({ jobId: editingJob.id, data: { ...form, status } });
    } else {
      createMutation.mutate({ ...form, status });
    }
  };

  const currencySymbol = CURRENCIES.find((c) => c.code === form.currency)?.symbol || "£";
  const isValid = !!(form.title && form.location && form.rate && form.event_date);

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

                <div className="mb-2 flex flex-wrap gap-3 text-sm text-gray-500">
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

                {/* Application stats */}
                <div className="mb-3 flex flex-wrap gap-2">
                  <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                    <Users className="h-3 w-3" />
                    {job.application_count ?? 0} applicant
                    {(job.application_count ?? 0) !== 1 ? "s" : ""}
                  </span>
                  {(job.shortlisted_count ?? 0) > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                      <BookmarkPlus className="h-3 w-3" />
                      {job.shortlisted_count} shortlisted
                    </span>
                  )}
                  {(job.hired_count ?? 0) > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                      <UserCheck className="h-3 w-3" />
                      {job.hired_count} accepted
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
                  <span>
                    View applicants
                    {(job.application_count ?? 0) > 0 && (
                      <span className="ml-1.5 rounded-full bg-gray-200 px-1.5 py-0.5 text-xs">
                        {job.application_count}
                      </span>
                    )}
                  </span>
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
            setShowAdditional(false);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingJob ? "Edit Job" : "Post a Job"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="title">Job Title *</Label>
              <Input
                id="title"
                placeholder="e.g. Sound Engineer for wedding"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>

            {/* Country + Location */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="country">Country *</Label>
                <CountrySelect
                  id="country"
                  value={form.country}
                  onChange={(v) => setForm((f) => ({ ...f, country: v }))}
                  placeholder="Select country..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="location">City / Location *</Label>
                <GlobalLocationInput
                  id="location"
                  value={form.location}
                  onChange={(v) => setForm((f) => ({ ...f, location: v }))}
                  placeholder="Start typing a city..."
                />
              </div>
            </div>

            {/* Currency + Rate + Date */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={form.currency}
                  onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}
                >
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rate">Rate * ({currencySymbol})</Label>
                <Input
                  id="rate"
                  placeholder="300"
                  value={form.rate}
                  onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event_date">Start Date *</Label>
                <Input
                  id="event_date"
                  type="date"
                  value={form.event_date}
                  onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
                />
              </div>
            </div>

            {/* Company (optional) */}
            <div className="space-y-1.5">
              <Label htmlFor="company">
                Event / Company Name{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="company"
                placeholder="e.g. The Grand Wedding Co"
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
              />
            </div>

            {/* Description — always visible */}
            <div className="space-y-1.5">
              <Label htmlFor="description">Job Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the role, requirements, and what you're looking for..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={4}
              />
            </div>

            {/* Additional details toggle */}
            <button
              type="button"
              onClick={() => setShowAdditional((s) => !s)}
              className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
            >
              {showAdditional ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
              Additional Details (optional)
            </button>

            {showAdditional && (
              <div className="space-y-4 border-t pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="end_date">End Date</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={form.end_date}
                      onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="start_time">Start Time</Label>
                    <Input
                      id="start_time"
                      type="time"
                      value={form.start_time}
                      onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="end_time">End Time</Label>
                    <Input
                      id="end_time"
                      type="time"
                      value={form.end_time}
                      onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => handleSubmit("private")}
                disabled={isPending || !isValid}
                variant="outline"
              >
                {isPending ? "Saving..." : editingJob ? "Save Changes" : "Save as Draft"}
              </Button>
              <Button
                onClick={() => handleSubmit("active")}
                disabled={isPending || !isValid}
                className="bg-gradient-to-r from-[#7B5EA7] to-[#9B7DC7] text-white hover:from-[#6a4f94] hover:to-[#8a6cb6]"
              >
                {isPending ? "Publishing..." : editingJob ? "Save & Publish" : "Publish Now"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
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
