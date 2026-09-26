import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CountrySelect } from "@/components/ui/country-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { GlobalLocationInput } from "@/components/ui/global-location-input";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Banknote,
  BookmarkPlus,
  Briefcase,
  Calendar,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  MapPin,
  Plus,
  RotateCcw,
  Search,
  Send,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  XCircle,
} from "lucide-react";
import type { Job } from "@shared/types";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: "Live", color: "text-green-700", bg: "bg-green-100" },
  private: { label: "Draft", color: "text-gray-600", bg: "bg-gray-100" },
  paused: { label: "Paused", color: "text-amber-700", bg: "bg-amber-100" },
  closed: { label: "Closed", color: "text-red-600", bg: "bg-red-100" },
};

const APP_STATUS: Record<string, { label: string; color: string }> = {
  applied: { label: "Applied", color: "text-blue-600" },
  reviewed: { label: "Reviewed", color: "text-amber-600" },
  shortlisted: { label: "Shortlisted", color: "text-purple-600" },
  hired: { label: "Accepted", color: "text-green-700" },
  rejected: { label: "Declined", color: "text-red-500" },
  invited: { label: "Invited", color: "text-indigo-600" },
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

interface FreelancerSearchResult {
  user_id: number;
  name: string;
  title?: string | null;
  location?: string | null;
}

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

  const [innerTab, setInnerTab] = useState<"jobs" | "applications" | "post">("jobs");
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [form, setForm] = useState<PostJobFormData>(EMPTY_FORM);
  const [showAdditional, setShowAdditional] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("openForm") === "1") {
      setInnerTab("post");
      setEditingJob(null);
      setForm(EMPTY_FORM);
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
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/my-posted"] });
      toast({
        title: vars.status === "active" ? "Job published" : "Draft saved",
        description:
          vars.status === "active"
            ? "Your job is now live."
            : "You can publish it any time from My Jobs.",
      });
      setForm(EMPTY_FORM);
      setInnerTab("jobs");
    },
    onError: (err: any) =>
      toast({ title: "Failed to post job", description: err?.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ jobId, data }: { jobId: number; data: Partial<PostJobFormData> }) =>
      apiRequest(`/api/jobs/${jobId}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/my-posted"] });
      toast({ title: "Job updated" });
      setEditingJob(null);
      setForm(EMPTY_FORM);
      setInnerTab("jobs");
    },
    onError: (err: any) =>
      toast({ title: "Failed to update job", description: err?.message, variant: "destructive" }),
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
      toast({ title: "Job unpublished", description: "Set back to draft." });
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
      toast({ title: "Job reopened", description: "It is now a draft. Publish when ready." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (jobId: number) => apiRequest(`/api/jobs/${jobId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/my-posted"] });
      toast({ title: "Job deleted" });
    },
  });

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
    setInnerTab("post");
  };

  const handleSubmit = (status: "private" | "active") => {
    if (editingJob) {
      updateMutation.mutate({ jobId: editingJob.id, data: { ...form, status } });
    } else {
      createMutation.mutate({ ...form, status });
    }
  };

  const cancelEdit = () => {
    setEditingJob(null);
    setForm(EMPTY_FORM);
    setShowAdditional(false);
    setInnerTab("jobs");
  };

  const currencySymbol = CURRENCIES.find((c) => c.code === form.currency)?.symbol || "£";
  const isValid = !!(form.title && form.location && form.rate && form.event_date);
  const isPending = createMutation.isPending || updateMutation.isPending;
  const totalApplications = postedJobs?.reduce((n, j) => n + (j.application_count ?? 0), 0) ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Tabs value={innerTab} onValueChange={(v) => setInnerTab(v as typeof innerTab)}>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="jobs" className="gap-1.5">
              <Briefcase className="h-4 w-4" />
              My Jobs
              {(postedJobs?.length ?? 0) > 0 && (
                <span className="ml-1 rounded-full bg-gray-200 px-1.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                  {postedJobs!.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="applications" className="gap-1.5">
              <Users className="h-4 w-4" />
              Applications
              {totalApplications > 0 && (
                <span className="ml-1 rounded-full bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                  {totalApplications}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="post" className="gap-1.5">
              <Plus className="h-4 w-4" />
              {editingJob ? "Edit Job" : "Post a Job"}
            </TabsTrigger>
          </TabsList>

          {innerTab === "jobs" && (
            <Button
              onClick={() => {
                setEditingJob(null);
                setForm(EMPTY_FORM);
                setInnerTab("post");
              }}
              className="shrink-0 gap-2 bg-gradient-to-r from-purple-600 to-purple-800 text-white hover:from-purple-700 hover:to-purple-900"
            >
              <Plus className="h-4 w-4" />
              Post a Job
            </Button>
          )}
        </div>

        {/* My Jobs */}
        <TabsContent value="jobs">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
            </div>
          ) : !postedJobs?.length ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                  <Briefcase className="h-8 w-8 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    No jobs posted yet
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Post a crew call or event opportunity to find the right people.
                  </p>
                </div>
                <Button
                  onClick={() => setInnerTab("post")}
                  className="gap-2 bg-gradient-to-r from-purple-600 to-purple-800 text-white hover:from-purple-700 hover:to-purple-900"
                >
                  <Plus className="h-4 w-4" />
                  Post your first job
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {postedJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onEdit={openEdit}
                  onPublish={(id) => publishMutation.mutate(id)}
                  onUnpublish={(id) => unpublishMutation.mutate(id)}
                  onClose={(id) => closeMutation.mutate(id)}
                  onReopen={(id) => reopenMutation.mutate(id)}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Applications */}
        <TabsContent value="applications">
          <AllApplicationsView jobs={postedJobs ?? []} isLoading={isLoading} />
        </TabsContent>

        {/* Post / Edit a Job */}
        <TabsContent value="post">
          <Card>
            <CardContent className="pt-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                {editingJob ? `Editing: ${editingJob.title}` : "Post a new job"}
              </h2>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="title">Job Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g. Sound Engineer for wedding"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  />
                </div>

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

                <div className="space-y-1.5">
                  <Label htmlFor="description">Job Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the role, requirements, and what you are looking for..."
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={4}
                  />
                </div>

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

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    onClick={() => handleSubmit("active")}
                    disabled={isPending || !isValid}
                    className="bg-gradient-to-r from-purple-600 to-purple-800 text-white hover:from-purple-700 hover:to-purple-900"
                  >
                    {isPending ? "Saving..." : editingJob ? "Save & Publish" : "Publish Now"}
                  </Button>
                  <Button
                    onClick={() => handleSubmit("private")}
                    disabled={isPending || !isValid}
                    variant="outline"
                  >
                    {isPending ? "Saving..." : "Save as Draft"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function JobCard({
  job,
  onEdit,
  onPublish,
  onUnpublish,
  onClose,
  onReopen,
  onDelete,
}: {
  job: Job;
  onEdit: (job: Job) => void;
  onPublish: (id: number) => void;
  onUnpublish: (id: number) => void;
  onClose: (id: number) => void;
  onReopen: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const [applicantsOpen, setApplicantsOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const statusCfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.private;

  const acceptMutation = useMutation({
    mutationFn: async (applicationId: number) =>
      apiRequest(`/api/applications/${applicationId}/accept`, { method: "PUT" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${job.id}/applications`] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/my-posted"] });
      toast({ title: "Applicant accepted" });
    },
    onError: (err: any) =>
      toast({ title: "Failed to accept", description: err?.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async (applicationId: number) =>
      apiRequest(`/api/applications/${applicationId}/reject`, { method: "PUT" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${job.id}/applications`] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/my-posted"] });
      toast({ title: "Applicant declined" });
    },
    onError: (err: any) =>
      toast({ title: "Failed to decline", description: err?.message, variant: "destructive" }),
  });

  const shortlistMutation = useMutation({
    mutationFn: async (applicationId: number) =>
      apiRequest(`/api/applications/${applicationId}/shortlist`, { method: "PUT" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${job.id}/applications`] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/my-posted"] });
      toast({ title: "Applicant shortlisted" });
    },
    onError: (err: any) =>
      toast({ title: "Failed to shortlist", description: err?.message, variant: "destructive" }),
  });

  const actionsPending =
    acceptMutation.isPending || rejectMutation.isPending || shortlistMutation.isPending;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm dark:border-gray-700 dark:bg-gray-800/50">
      <div className="mb-2 flex items-start justify-between gap-2">
        <button
          onClick={() => onEdit(job)}
          className="text-left font-semibold text-gray-900 hover:text-purple-700 dark:text-white dark:hover:text-purple-400"
        >
          {job.title}
        </button>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusCfg.bg} ${statusCfg.color}`}
        >
          {statusCfg.label}
        </span>
      </div>

      <div className="mb-2 flex flex-wrap gap-3 text-sm text-gray-500 dark:text-gray-400">
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

      <div className="mb-3 flex flex-wrap gap-2">
        <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
          <Users className="h-3 w-3" />
          {job.application_count ?? 0} applicant{(job.application_count ?? 0) !== 1 ? "s" : ""}
        </span>
        {(job.shortlisted_count ?? 0) > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
            <BookmarkPlus className="h-3 w-3" />
            {job.shortlisted_count} shortlisted
          </span>
        )}
        {(job.hired_count ?? 0) > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
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
            onClick={() => onPublish(job.id)}
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
            onClick={() => onUnpublish(job.id)}
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
              onClick={() => onEdit(job)}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-xs"
              onClick={() => setInviteOpen(true)}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Invite
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-xs text-red-600 hover:bg-red-50"
              onClick={() => onClose(job.id)}
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
            onClick={() => onReopen(job.id)}
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
                This will permanently remove &quot;{job.title}&quot; and notify any applicants. This
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => onDelete(job.id)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <button
        onClick={() => setApplicantsOpen((o) => !o)}
        className="mt-3 flex w-full items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        <span>
          View applicants
          {(job.application_count ?? 0) > 0 && (
            <span className="ml-1.5 rounded-full bg-gray-200 px-1.5 py-0.5 text-xs dark:bg-gray-600">
              {job.application_count}
            </span>
          )}
        </span>
        {applicantsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {applicantsOpen && (
        <ApplicantsPanel
          jobId={job.id}
          onAccept={(id) => acceptMutation.mutate(id)}
          onReject={(id) => rejectMutation.mutate(id)}
          onShortlist={(id) => shortlistMutation.mutate(id)}
          isPending={actionsPending}
        />
      )}

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        jobId={job.id}
        jobTitle={job.title}
      />
    </div>
  );
}

function AllApplicationsView({ jobs, isLoading }: { jobs: Job[]; isLoading: boolean }) {
  const [selectedJobId, setSelectedJobId] = useState<number | "all">("all");
  const jobsWithApps = jobs.filter((j) => (j.application_count ?? 0) > 0);
  const filteredJobs = selectedJobId === "all" ? jobs : jobs.filter((j) => j.id === selectedJobId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!jobs.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <FileText className="h-10 w-10 text-gray-300" />
          <p className="text-gray-500">
            No jobs posted yet. Post a job to start receiving applications.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {jobsWithApps.length > 1 && (
        <div className="flex items-center gap-2">
          <Label className="shrink-0 text-sm">Filter by job:</Label>
          <Select
            value={String(selectedJobId)}
            onValueChange={(v) => setSelectedJobId(v === "all" ? "all" : parseInt(v))}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All jobs</SelectItem>
              {jobsWithApps.map((j) => (
                <SelectItem key={j.id} value={String(j.id)}>
                  {j.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {filteredJobs.map((job) => (
        <ApplicationsForJob key={job.id} job={job} />
      ))}
    </div>
  );
}

function ApplicationsForJob({ job }: { job: Job }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const statusCfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.private;

  const { data: apps, isLoading } = useQuery<Applicant[]>({
    queryKey: [`/api/jobs/${job.id}/applications`],
  });

  const acceptMutation = useMutation({
    mutationFn: async (id: number) =>
      apiRequest(`/api/applications/${id}/accept`, { method: "PUT" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${job.id}/applications`] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/my-posted"] });
      toast({ title: "Applicant accepted" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: number) =>
      apiRequest(`/api/applications/${id}/reject`, { method: "PUT" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${job.id}/applications`] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/my-posted"] });
      toast({ title: "Applicant declined" });
    },
  });

  const shortlistMutation = useMutation({
    mutationFn: async (id: number) =>
      apiRequest(`/api/applications/${id}/shortlist`, { method: "PUT" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${job.id}/applications`] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/my-posted"] });
      toast({ title: "Applicant shortlisted" });
    },
  });

  const isPending =
    acceptMutation.isPending || rejectMutation.isPending || shortlistMutation.isPending;

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/50">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">{job.title}</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.bg} ${statusCfg.color}`}
        >
          {statusCfg.label}
        </span>
      </div>
      <div className="p-3">
        {isLoading ? (
          <div className="py-4 text-center text-sm text-gray-400">Loading...</div>
        ) : !apps?.length ? (
          <div className="py-6 text-center text-sm text-gray-400">No applications yet</div>
        ) : (
          <div className="space-y-2">
            {apps.map((app) => (
              <ApplicationRow
                key={app.id}
                app={app}
                onAccept={() => acceptMutation.mutate(app.id)}
                onReject={() => rejectMutation.mutate(app.id)}
                onShortlist={() => shortlistMutation.mutate(app.id)}
                isPending={isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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
  const { data, isLoading } = useQuery<Applicant[]>({
    queryKey: [`/api/jobs/${jobId}/applications`],
  });

  if (isLoading)
    return <div className="mt-3 py-4 text-center text-sm text-gray-400">Loading applicants...</div>;

  if (!data?.length)
    return (
      <div className="mt-3 rounded-lg bg-gray-50 py-6 text-center text-sm text-gray-400 dark:bg-gray-700/30">
        No applications yet
      </div>
    );

  return (
    <div className="mt-3 space-y-2">
      {data.map((app) => (
        <ApplicationRow
          key={app.id}
          app={app}
          onAccept={() => onAccept(app.id)}
          onReject={() => onReject(app.id)}
          onShortlist={() => onShortlist(app.id)}
          isPending={isPending}
        />
      ))}
    </div>
  );
}

function ApplicationRow({
  app,
  onAccept,
  onReject,
  onShortlist,
  isPending,
}: {
  app: Applicant;
  onAccept: () => void;
  onReject: () => void;
  onShortlist: () => void;
  isPending: boolean;
}) {
  const [coverOpen, setCoverOpen] = useState(false);
  const cfg = APP_STATUS[app.status] ?? { label: app.status, color: "text-gray-500" };
  const canAct = ["applied", "reviewed"].includes(app.status);
  const canAccept = ["applied", "reviewed", "shortlisted"].includes(app.status);

  return (
    <div className="rounded-lg border border-gray-100 bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <a
            href={`/profile/${app.freelancer_id}`}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-gray-900 hover:text-purple-700 hover:underline dark:text-white dark:hover:text-purple-400"
          >
            {app.freelancer_name}
          </a>
          {app.freelancer_title && (
            <p className="truncate text-xs text-gray-400">{app.freelancer_title}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
          {app.cover_letter && (
            <button
              onClick={() => setCoverOpen((o) => !o)}
              title={coverOpen ? "Hide cover letter" : "View cover letter"}
              className="rounded p-1 text-gray-400 hover:bg-gray-50 hover:text-gray-600 dark:hover:bg-gray-700"
            >
              {coverOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
          {canAct && (
            <button
              onClick={onShortlist}
              disabled={isPending}
              title="Shortlist"
              className="rounded p-1 text-purple-600 hover:bg-purple-50 disabled:opacity-40 dark:hover:bg-purple-900/20"
            >
              <BookmarkPlus className="h-4 w-4" />
            </button>
          )}
          {canAccept && (
            <button
              onClick={onAccept}
              disabled={isPending}
              title="Accept"
              className="rounded p-1 text-green-600 hover:bg-green-50 disabled:opacity-40 dark:hover:bg-green-900/20"
            >
              <UserCheck className="h-4 w-4" />
            </button>
          )}
          {(canAct || app.status === "shortlisted") && (
            <button
              onClick={onReject}
              disabled={isPending}
              title="Decline"
              className="rounded p-1 text-red-500 hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-900/20"
            >
              <UserX className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      {coverOpen && app.cover_letter && (
        <p className="mt-2 whitespace-pre-wrap rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-gray-700/50 dark:text-gray-300">
          {app.cover_letter}
        </p>
      )}
    </div>
  );
}

function InviteDialog({
  open,
  onOpenChange,
  jobId,
  jobTitle,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  jobId: number;
  jobTitle: string;
}) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results, isLoading: searching } = useQuery<FreelancerSearchResult[]>({
    queryKey: ["/api/freelancers/search", debouncedQuery],
    queryFn: () =>
      apiRequest(`/api/freelancers/search?q=${encodeURIComponent(debouncedQuery)}&limit=8`),
    enabled: debouncedQuery.length >= 2,
  });

  const inviteMutation = useMutation({
    mutationFn: async (freelancerId: number) =>
      apiRequest("/api/applications/invite", {
        method: "POST",
        body: JSON.stringify({ jobId, freelancerId, message }),
      }),
    onSuccess: () => {
      toast({ title: "Invitation sent", description: "They will receive a notification." });
      onOpenChange(false);
      setQuery("");
      setMessage("");
    },
    onError: (err: any) =>
      toast({
        title: "Failed to send invite",
        description: err?.message,
        variant: "destructive",
      }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite someone to apply</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500">
          Search for a freelancer to invite to <strong>{jobTitle}</strong>.
        </p>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Search by name or title..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {debouncedQuery.length >= 2 && (
          <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
            {searching ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : !results?.length ? (
              <p className="py-6 text-center text-sm text-gray-400">No freelancers found</p>
            ) : (
              results.map((f) => (
                <button
                  key={f.user_id}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={() => inviteMutation.mutate(f.user_id)}
                  disabled={inviteMutation.isPending}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-semibold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                    {f.name
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                      {f.name}
                    </p>
                    {f.title && <p className="truncate text-xs text-gray-400">{f.title}</p>}
                  </div>
                  <Send className="ml-auto h-4 w-4 shrink-0 text-purple-600" />
                </button>
              ))
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="invite-msg">
            Personal message <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="invite-msg"
            placeholder="Add a note about why you are reaching out..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
