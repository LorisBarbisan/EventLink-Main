import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { usePersistentState } from "@/hooks/usePersistentState";
import { apiRequest } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { MessageSquare, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

const feedbackSchema = z.object({
  feedbackType: z.enum(["malfunction", "feature-missing", "suggestion", "other"], {
    required_error: "Please select a feedback type",
  }),
  message: z.string().min(10, "Please provide at least 10 characters of feedback"),
});

type FeedbackFormData = z.infer<typeof feedbackSchema>;

interface FeedbackFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source?: "header" | "popup";
}

const feedbackTypes = [
  { value: "malfunction", label: "Malfunction" },
  { value: "feature-missing", label: "Feature Missing" },
  { value: "suggestion", label: "Suggestion" },
  { value: "other", label: "Other" },
];

export function FeedbackForm({ open, onOpenChange, source = "header" }: FeedbackFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Default empty values
  const defaultValues: Partial<FeedbackFormData> = {
    feedbackType: undefined,
    message: "",
  };

  const [draft, setDraft, clearDraft, isDraftDirty] = usePersistentState<Partial<FeedbackFormData>>(
    "feedback_draft",
    defaultValues
  );

  const form = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: draft as FeedbackFormData,
    mode: "onChange",
  });

  // Sync form changes to persistent state
  const watchedValues = useWatch({ control: form.control });

  useEffect(() => {
    // Only update draft if open (to avoid clearing it when dialog unmounts if that were the case,
    // though here component might stay mounted. But mainly to capture user input).
    if (open) {
      setDraft(watchedValues as Partial<FeedbackFormData>);
    }
  }, [watchedValues, open, setDraft]);

  // Reset form to draft when opening if needed, or if draft explicitly changes externally?
  // Actually, useForm defaultValues handles initial load.
  // But if we clear draft, we might want to reset form.
  useEffect(() => {
    if (open) {
      // Ensure form matches draft on open (in case it was closed without clearing)
      // This is important because the component might not unmount.
      form.reset(draft as FeedbackFormData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form]);

  const submitMutation = useMutation({
    mutationFn: async (data: FeedbackFormData) => {
      setIsSubmitting(true);
      const feedbackData = {
        ...data,
        pageUrl: window.location.pathname,
        timestamp: new Date().toISOString(),
        source,
      };

      return await apiRequest("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feedbackData),
      });
    },
    onSuccess: () => {
      toast({
        title: "Thank you for your feedback!",
        description: "Your feedback has been sent successfully. We appreciate your input.",
      });
      // Clear draft and reset form
      clearDraft();
      form.reset(defaultValues as FeedbackFormData);
      onOpenChange(false);

      // Mark feedback as submitted in session storage
      sessionStorage.setItem("feedback_submitted", "true");
    },
    onError: (error) => {
      console.error("Feedback submission error:", error);
      toast({
        title: "Something went wrong",
        description: "Unable to send your feedback. Please try again later.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const handleSubmit = (data: FeedbackFormData) => {
    submitMutation.mutate(data);
  };

  const handleClose = () => {
    if (source === "popup") {
      // Mark popup as dismissed to prevent showing again this session
      sessionStorage.setItem("feedback_popup_dismissed", "true");
    }
    // Just close, keep draft
    onOpenChange(false);
  };

  const handleCancel = () => {
    if (isDraftDirty) {
      setShowConfirmDialog(true);
    } else {
      handleClose();
    }
  };

  const handleConfirmDiscard = () => {
    clearDraft();
    form.reset(defaultValues as FeedbackFormData);
    setShowConfirmDialog(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <ConfirmDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        title="Unsaved Changes"
        description="You have unsaved feedback. Are you sure you want to discard it?"
        onConfirm={handleConfirmDiscard}
        onCancel={() => setShowConfirmDialog(false)}
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              Share Your Feedback
            </DialogTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Help us improve EventLink by sharing your thoughts, reporting issues, or suggesting new
            features.
          </p>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="feedbackType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Feedback Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-feedback-type">
                        <SelectValue placeholder="Select feedback type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {feedbackTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Feedback</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Please describe your feedback in detail..."
                      className="min-h-[120px] resize-none"
                      data-testid="textarea-feedback-message"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
                data-testid="button-cancel-feedback"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} data-testid="button-submit-feedback">
                {isSubmitting ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Feedback
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
