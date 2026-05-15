import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import { Loader2, User } from "lucide-react";

interface CrewFreelancer {
  user_id: number;
  first_name: string;
  last_name: string;
  profile_image_url: string | null;
  title: string | null;
  location: string | null;
  isSaved: boolean;
}

interface FormValues {
  eventTitle: string;
  eventDate: string;
  eventEndDate: string;
  callTime: string;
  venueAddress: string;
  roleRequired: string;
  agreedRate: string;
  additionalNotes: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedFreelancerIds?: number[];
}

export function SendEnquiryModal({ open, onOpenChange, preselectedFreelancerIds = [] }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<number[]>(preselectedFreelancerIds);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      eventTitle: "",
      eventDate: "",
      eventEndDate: "",
      callTime: "",
      venueAddress: "",
      roleRequired: "",
      agreedRate: "",
      additionalNotes: "",
    },
  });

  const { data: crew = [], isLoading: crewLoading } = useQuery<CrewFreelancer[]>({
    queryKey: ["/api/my-crew"],
    queryFn: () => apiRequest("/api/my-crew"),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: (payload: FormValues & { freelancerIds: number[] }) =>
      apiRequest("/api/enquiries", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      toast({ title: "Availability enquiry sent", description: "Freelancers have been notified by email." });
      queryClient.invalidateQueries({ queryKey: ["/api/enquiries"] });
      reset();
      setSelectedIds([]);
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Failed to send enquiry", description: err?.message ?? "Please try again.", variant: "destructive" });
    },
  });

  const toggleId = (id: number) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const onSubmit = (values: FormValues) => {
    if (selectedIds.length === 0) {
      toast({ title: "Select at least one freelancer", variant: "destructive" });
      return;
    }
    mutation.mutate({ ...values, freelancerIds: selectedIds });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-xl">Send Availability Enquiry</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {/* Section 1: Event Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Event Details</h3>
              <div className="space-y-2">
                <Label htmlFor="eventTitle">
                  Event title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="eventTitle"
                  placeholder="e.g. Summer Music Festival"
                  {...register("eventTitle", { required: "Event title is required" })}
                />
                {errors.eventTitle && <p className="text-xs text-destructive">{errors.eventTitle.message}</p>}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="eventDate">
                    Event date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="eventDate"
                    type="date"
                    {...register("eventDate", { required: "Event date is required" })}
                  />
                  {errors.eventDate && <p className="text-xs text-destructive">{errors.eventDate.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eventEndDate">End date (optional)</Label>
                  <Input id="eventEndDate" type="date" {...register("eventEndDate")} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="callTime">Call time (optional)</Label>
                <Input id="callTime" type="time" {...register("callTime")} />
              </div>
            </div>

            {/* Section 2: Location & Role */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Location &amp; Role</h3>
              <div className="space-y-2">
                <Label htmlFor="venueAddress">Venue address (optional)</Label>
                <Input id="venueAddress" placeholder="e.g. Alexandra Palace, London" {...register("venueAddress")} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="roleRequired">Role required (optional)</Label>
                  <Input id="roleRequired" placeholder="e.g. Stage Manager" {...register("roleRequired")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="agreedRate">Rate (optional)</Label>
                  <Input id="agreedRate" placeholder="e.g. £200/day" {...register("agreedRate")} />
                </div>
              </div>
            </div>

            {/* Section 3: Message */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Message</h3>
              <div className="space-y-2">
                <Label htmlFor="additionalNotes">Additional notes (optional)</Label>
                <Textarea
                  id="additionalNotes"
                  placeholder="Any additional context for the freelancers..."
                  rows={3}
                  {...register("additionalNotes")}
                />
              </div>
            </div>

            {/* Section 4: Select Freelancers */}
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
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
      </DialogContent>
    </Dialog>
  );
}
