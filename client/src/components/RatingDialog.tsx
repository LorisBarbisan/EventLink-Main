import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { JobApplication } from "@shared/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { StarRating } from "./StarRating";

interface RatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: JobApplication;
  currentUserId: number;
}

export function RatingDialog({
  open,
  onOpenChange,
  application,
  currentUserId,
}: RatingDialogProps) {
  const [rating, setRating] = useState<number>(0);
  const [review, setReview] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const submitRatingMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_application_id: application.id,
          freelancer_id: application.freelancer_id,
          recruiter_id: currentUserId,
          rating: rating,
          review: review.trim() || null,
        }),
      });
    },
    onSuccess: async () => {
      // Invalidate and refetch recruiter applications to update the UI
      await queryClient.invalidateQueries({
        queryKey: ["/api/recruiter", currentUserId, "applications"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["/api/ratings", "freelancer", application.freelancer_id],
      });
      onOpenChange(false);
      setRating(0);
      setReview("");
      toast({
        title: "Rating submitted successfully!",
        description: `You've rated ${application.freelancer_profile?.first_name || "the freelancer"} ${rating} stars.`,
      });
    },
    onError: (error: any) => {
      console.error("Rating submission error:", error);
      toast({
        title: "Error submitting rating",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (rating === 0) {
      toast({
        title: "Please select a rating",
        description: "Choose between 1 and 5 stars.",
        variant: "destructive",
      });
      return;
    }
    submitRatingMutation.mutate();
  };

  const handleCancel = () => {
    setRating(0);
    setReview("");
    onOpenChange(false);
  };

  const freelancerName = application.freelancer_profile
    ? `${application.freelancer_profile.first_name} ${application.freelancer_profile.last_name}`
    : "this freelancer";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rate {freelancerName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              How would you rate {freelancerName}'s performance on{" "}
              <strong>"{application.job_title}"</strong>?
            </p>
          </div>

          <div className="flex flex-col items-center space-y-4">
            <StarRating
              rating={rating}
              setRating={setRating}
              size="lg"
              className="justify-center"
            />

            {rating > 0 && (
              <p className="text-sm text-center text-muted-foreground">
                {rating === 1 && "Poor - Did not meet expectations"}
                {rating === 2 && "Below Average - Met some expectations"}
                {rating === 3 && "Average - Met expectations"}
                {rating === 4 && "Good - Exceeded expectations"}
                {rating === 5 && "Excellent - Far exceeded expectations"}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="review" className="text-sm font-medium">
              Add a review (optional)
            </label>
            <textarea
              id="review"
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px]"
              placeholder="Share details about your experience working with this freelancer..."
              value={review}
              onChange={e => setReview(e.target.value)}
              maxLength={500}
            />
            <div className="text-xs text-muted-foreground text-right">
              {review.length}/500 characters
            </div>
          </div>

          {application.freelancer_profile && (
            <div className="bg-muted p-3 rounded-lg text-sm">
              <p>
                <strong>Freelancer:</strong> {freelancerName}
              </p>
              <p>
                <strong>Position:</strong> {application.freelancer_profile.title || "Freelancer"}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={submitRatingMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={rating === 0 || submitRatingMutation.isPending}
            data-testid="button-submit-rating"
          >
            {submitRatingMutation.isPending ? "Submitting..." : "Submit Rating"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
