import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { StarRating } from './StarRating';
import type { JobApplication } from '@shared/types';

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
  currentUserId 
}: RatingDialogProps) {
  const [rating, setRating] = useState<number>(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const submitRatingMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_application_id: application.id,
          freelancer_id: application.freelancer_id,
          rating: rating
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recruiter', currentUserId, 'applications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ratings', 'freelancer', application.freelancer_id] });
      onOpenChange(false);
      setRating(0);
      toast({
        title: 'Rating submitted successfully!',
        description: `You've rated ${application.freelancer_profile?.first_name || 'the freelancer'} ${rating} stars.`,
      });
    },
    onError: (error: any) => {
      console.error('Rating submission error:', error);
      toast({
        title: 'Error submitting rating',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = () => {
    if (rating === 0) {
      toast({
        title: 'Please select a rating',
        description: 'Choose between 1 and 5 stars.',
        variant: 'destructive',
      });
      return;
    }
    submitRatingMutation.mutate();
  };

  const handleCancel = () => {
    setRating(0);
    onOpenChange(false);
  };

  const freelancerName = application.freelancer_profile 
    ? `${application.freelancer_profile.first_name} ${application.freelancer_profile.last_name}`
    : 'this freelancer';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rate {freelancerName}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              How would you rate {freelancerName}'s performance on <strong>"{application.job_title}"</strong>?
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

          {application.freelancer_profile && (
            <div className="bg-muted p-3 rounded-lg text-sm">
              <p><strong>Freelancer:</strong> {freelancerName}</p>
              <p><strong>Position:</strong> {application.freelancer_profile.title || 'Freelancer'}</p>
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
            {submitRatingMutation.isPending ? 'Submitting...' : 'Submit Rating'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}