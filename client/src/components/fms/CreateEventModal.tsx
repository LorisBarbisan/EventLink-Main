import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Briefcase, CalendarDays, Loader2, UserCheck } from "lucide-react";
import { useLocation } from "wouter";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: Date | null;
}

interface BookingFormValues {
  freelancerId: string;
  eventDate: string;
  agreedRate: string;
  callTime: string;
  venueAddress: string;
  employerNotes: string;
}

export function CreateEventModal({ open, onOpenChange, initialDate }: Props) {
  const [choice, setChoice] = useState<"choose" | "booking">("choose");
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const defaultDate = initialDate ? format(initialDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");

  const form = useForm<BookingFormValues>({
    defaultValues: {
      freelancerId: "",
      eventDate: defaultDate,
      agreedRate: "",
      callTime: "",
      venueAddress: "",
      employerNotes: "",
    },
  });

  const { data: crewData = [] } = useQuery<any[]>({
    queryKey: ["/api/my-crew"],
    queryFn: () => apiRequest("/api/my-crew"),
    enabled: open && choice === "booking",
  });

  const createBookingMutation = useMutation({
    mutationFn: async (values: BookingFormValues) => {
      if (!values.freelancerId) throw new Error("Select a freelancer");
      return apiRequest("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          freelancerId: parseInt(values.freelancerId),
          jobId: null,
          eventDate: values.eventDate,
          agreedRate: values.agreedRate || null,
          callTime: values.callTime || null,
          venueAddress: values.venueAddress || null,
          employerNotes: values.employerNotes || null,
          status: "confirmed",
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/calendar"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      toast({ title: "Booking created" });
      onOpenChange(false);
      setChoice("choose");
      form.reset();
    },
    onError: (err: any) => {
      toast({ title: "Failed to create booking", description: err?.message, variant: "destructive" });
    },
  });

  const handleClose = () => {
    onOpenChange(false);
    setChoice("choose");
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {choice === "choose"
              ? "Add to Calendar"
              : "Create Direct Booking"}
          </DialogTitle>
        </DialogHeader>

        {choice === "choose" && (
          <div className="grid grid-cols-2 gap-3 py-2">
            <button
              className="flex flex-col items-center gap-3 rounded-xl border-2 border-muted hover:border-primary p-5 text-center transition-colors cursor-pointer"
              onClick={() => {
                handleClose();
                setLocation("/employer?tab=jobs&action=create");
              }}
            >
              <Briefcase className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-semibold text-sm">Post a Job</p>
                <p className="text-xs text-muted-foreground mt-0.5">Create a job listing</p>
              </div>
            </button>
            <button
              className="flex flex-col items-center gap-3 rounded-xl border-2 border-muted hover:border-primary p-5 text-center transition-colors cursor-pointer"
              onClick={() => {
                form.setValue("eventDate", defaultDate);
                setChoice("booking");
              }}
            >
              <UserCheck className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-semibold text-sm">Direct Booking</p>
                <p className="text-xs text-muted-foreground mt-0.5">Book a crew member directly</p>
              </div>
            </button>
          </div>
        )}

        {choice === "booking" && (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((v) => createBookingMutation.mutate(v))}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="freelancerId"
                rules={{ required: "Select a freelancer" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Freelancer</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="">Select from My Crew…</option>
                        {(crewData as any[]).map((f: any) => (
                          <option key={f.userId} value={f.userId}>
                            {f.name} {f.title ? `— ${f.title}` : ""}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="eventDate"
                rules={{ required: "Date is required" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="agreedRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agreed Rate</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. £200/day" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="callTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Call Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="venueAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Venue Address</FormLabel>
                    <FormControl>
                      <Input placeholder="Venue or location" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="employerNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Any additional notes…" rows={2} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setChoice("choose")}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={createBookingMutation.isPending}
                >
                  {createBookingMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Create Booking
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
