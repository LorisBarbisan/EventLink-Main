import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { X, Send, MessageSquare } from 'lucide-react';

const feedbackSchema = z.object({
  feedbackType: z.enum(['malfunction', 'feature-missing', 'suggestion', 'other'], {
    required_error: 'Please select a feedback type',
  }),
  message: z.string().min(10, 'Please provide at least 10 characters of feedback'),
});

type FeedbackFormData = z.infer<typeof feedbackSchema>;

interface FeedbackFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source?: 'header' | 'popup';
}

const feedbackTypes = [
  { value: 'malfunction', label: 'Malfunction' },
  { value: 'feature-missing', label: 'Feature Missing' },
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'other', label: 'Other' },
];

export function FeedbackForm({ open, onOpenChange, source = 'header' }: FeedbackFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      feedbackType: undefined,
      message: '',
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: FeedbackFormData) => {
      setIsSubmitting(true);
      const feedbackData = {
        ...data,
        pageUrl: window.location.pathname,
        timestamp: new Date().toISOString(),
        source,
      };
      
      return await apiRequest('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedbackData),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Thank you for your feedback!',
        description: 'Your feedback has been sent successfully. We appreciate your input.',
      });
      form.reset();
      onOpenChange(false);
      
      // Mark feedback as submitted in session storage
      sessionStorage.setItem('feedback_submitted', 'true');
    },
    onError: (error) => {
      console.error('Feedback submission error:', error);
      toast({
        title: 'Something went wrong',
        description: 'Unable to send your feedback. Please try again later.',
        variant: 'destructive',
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
    if (source === 'popup') {
      // Mark popup as dismissed to prevent showing again this session
      sessionStorage.setItem('feedback_popup_dismissed', 'true');
    }
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              Share Your Feedback
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              data-testid="button-close-feedback"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Help us improve EventLink by sharing your thoughts, reporting issues, or suggesting new features.
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

            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1"
                data-testid="button-submit-feedback"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Feedback
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
                data-testid="button-cancel-feedback"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}