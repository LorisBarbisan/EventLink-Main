import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Briefcase, CalendarDays, ChevronLeft, Loader2, MapPin, User } from "lucide-react";
import { format, parseISO } from "date-fns";

interface CrewFreelancer {
  user_id: number;
  first_name: string;
  last_name: string;
  profile_image_url: string | null;
  title: string | null;
  location: string | null;
  isSaved: boolean;
}

interface RecruiterJob {
  id: number;
  title: string;
  location: string;
  event_date: string;
  status: string;
  rate?: string;
}

interface EnquiryFormValues {
  callTime: string;
  roleRequired: string;
  agreedRate: string;
  additionalNotes: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedFreelancerIds?: number[];
  onGoToCreateJob?: () => void;
}

function formatJobDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "No date set";
  try {
    return format(parseISO(dateStr), "d MMM yyyy");
  } catch {
    return dateStr;
  }
}

export function SendEnquiryModal({ open, onOpenChange, preselectedFreelancerIds = [], onGoToCreateJob }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<"select-job" | "enquiry-form">("select-job");
  const [selectedJob, setSelectedJob] = useState<RecruiterJob | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>(preselectedFreelancerIds);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EnquiryFormValues>({
    defaultValues: { callTime: "", roleRequired: "", agreedRate: "", additionalNotes: "" },
  });

  const { data: recruiterJobs = [], isLoading: jobsLoading } = useQuery<RecruiterJob[]>({
    queryKey: ["/api/jobs/recruiter", user?.id],
    queryFn: () => apiRequest(`/api/jobs/recruiter/${user?.id}`),
    enabled: open && !!user?.id,
  });

  const availableJobs = recruiterJobs.filter((j) => j.status !== "closed");

  const { data: crew = [], isLoading: crewLoading } = useQuery<CrewFreelancer[]>({
    queryKey: ["/api/my-crew"],
    queryFn: () => apiRequest("/api/my-crew"),
    enabled: open && step === "enquiry-form",
  });

  const mutation = useMutation({
    mutationFn: (payload: EnquiryFormValues & {
      eventTitle: string;
      eventDate: string;
      eventEndDate: string;
      venueAddress: string;
      freelancerIds: number[];
    }) =>
      apiRequest("/api/enquiries", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      toast({ title: "Availability enquiry sent", description: "Freelancers have been notified by email." });
      queryClient.invalidateQueries({ queryKey: ["/api/enquiries"] });
      handleClose();
    },
    onError: (err: any) => {
      toast({ title: "Failed to send enquiry", description: err?.message ?? "Please try again.", variant: "destructive" });
    },
  });

  const toggleId = (id: number) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleClose = () => {
    onOpenChange(false);
    setStep("select-job");
    setSelectedJob(null);
    setSelectedIds([]);
    reset();
  };

  const handleSelectJob = (job: RecruiterJob) => {
    setSelectedJob(job);
    setStep("enquiry-form");
  };

  const onSubmit = (values: EnquiryFormValues) => {
    if (!selectedJob) return;
    if (selectedIds.length === 0) {
      toast({ title: "Select at least one freelancer", variant: "destructive" });
      return;
    }
    mutation.mutate({
      ...values,
      eventTitle: selectedJob.title,
      eventDate: selectedJob.event_date ?? "",
      eventEndDate: "",
      venueAddress: selectedJob.location ?? "",
      freelancerIds: selectedIds,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-xl">
            {step === "select-job" ? "Send Availability Enquiry" : "Availability Enquiry"}
          </DialogTitle>
        </DialogHeader>

        {/* ── Step 1: Job Selection ── */}
        {step === "select-job" && (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <p className="text-sm text-muted-foreground">
              Select the job you want to check availability for. The enquiry will be sent on behalf of this job.
            </p>

            {jobsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : availableJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-12 text-center">
                <Briefcase className="h-10 w-10 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">No jobs yet</p>
                  <p className="mt-1 text-sm text-muted-foreground max-w-xs">
                    You need to create a job first before sending availability enquiries.
                  </p>
                </div>
                {onGoToCreateJob && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      handleClose();
                      onGoToCreateJob();
                    }}
                  >
                    <Briefcase className="mr-2 h-4 w-4" />
                    Create a Job
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {availableJobs.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => handleSelectJob(job)}
                    className="w-full rounded-lg border bg-background px-4 py-3.5 text-left transition-colors hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-sm">{job.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          {job.event_date && (
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {formatJobDate(job.event_date)}
                            </span>
                          )}
                          {job.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {job.location}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          job.status === "active"
                            ? "border-green-300 text-green-700 bg-green-50 dark:bg-green-950/30 text-xs shrink-0"
                            : "text-xs shrink-0"
                        }
                      >
                        {job.status === "active" ? "Posted" : job.status === "private" ? "Unposted" : job.status}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="pt-2 flex justify-end border-t">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Enquiry Form ── */}
        {step === "enquiry-form" && selectedJob && (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              {/* Selected job pill */}
              <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
                <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{selectedJob.title}</p>
                  <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground mt-0.5">
                    {selectedJob.event_date && (
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {formatJobDate(selectedJob.event_date)}
                      </span>
                    )}
                    {selectedJob.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {selectedJob.location}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-xs h-7 px-2"
                  onClick={() => setStep("select-job")}
                >
                  <ChevronLeft className="h-3 w-3 mr-1" />
                  Change
                </Button>
              </div>

              {/* Additional Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Additional Details</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="callTime">Call time (optional)</Label>
                    <Input id="callTime" type="time" {...register("callTime")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agreedRate">Rate (optional)</Label>
                    <Input id="agreedRate" placeholder="e.g. £200/day" {...register("agreedRate")} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="roleRequired">Role required (optional)</Label>
                  <Input id="roleRequired" placeholder="e.g. Stage Manager" {...register("roleRequired")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="additionalNotes">Message (optional)</Label>
                  <Textarea
                    id="additionalNotes"
                    placeholder="Any additional context for the freelancers..."
                    rows={3}
                    {...register("additionalNotes")}
                  />
                </div>
              </div>

              {/* Freelancer Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Select Freelancers</h3>
                  {selectedIds.length > 0 && (
                    <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">
                      {selectedIds.length} selected
                    </Badge>
                  )}
                </div>

                {crewLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : crew.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No saved freelancers yet. Save freelancers from the Find Crew page first.
                  </p>
                ) : (
                  <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
                    {crew.map((fl) => (
                      <label
                        key={fl.user_id}
                        className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                      >
                        <Checkbox
                          checked={selectedIds.includes(fl.user_id)}
                          onCheckedChange={() => toggleId(fl.user_id)}
                        />
                        {fl.profile_image_url ? (
                          <img
                            src={fl.profile_image_url}
                            alt={`${fl.first_name} ${fl.last_name}`}
                            className="h-9 w-9 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-orange-100">
                            <User className="h-4 w-4 text-orange-600" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-tight truncate">
                            {fl.first_name} {fl.last_name}
                          </p>
                          {fl.title && (
                            <p className="text-xs text-muted-foreground truncate">{fl.title}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="px-6 py-4 border-t gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("select-job")}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button
                type="submit"
                disabled={selectedIds.length === 0 || mutation.isPending}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Enquiry
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
