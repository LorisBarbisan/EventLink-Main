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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { StarRating } from "./StarRating";

interface StandaloneRatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  freelancerId: number;
  freelancerName: string;
  recruiterId: number;
}

export function StandaloneRatingDialog({
  open,
  onOpenChange,
  freelancerId,
  freelancerName,
  recruiterId,
}: StandaloneRatingDialogProps) {
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
          job_application_id: null, // Standalone rating
          freelancer_id: freelancerId,
          recruiter_id: recruiterId,
          rating: rating,
          review: review.trim() || null,
        }),
      });
    },
    onSuccess: async () => {
      // Invalidate both potential query keys to update UI
      await queryClient.invalidateQueries({
        queryKey: ["/api/ratings", "freelancer", freelancerId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["/api/ratings/freelancer", freelancerId], // Ensure both styles are covered
      });

      onOpenChange(false);
      setRating(0);
      setReview("");
      toast({
        title: "Rating submitted successfully!",
        description: `You've rated ${freelancerName} ${rating} stars.`,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rate {freelancerName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              How would you rate your experience working with {freelancerName}?
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

          <div className="bg-muted/50 p-3 rounded-lg text-xs text-muted-foreground">
            <p>
              This is a direct client review. It will help build the freelancer's reputation on
              EventLink.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={submitRatingMutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={rating === 0 || submitRatingMutation.isPending}>
            {submitRatingMutation.isPending ? "Submitting..." : "Submit Rating"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
