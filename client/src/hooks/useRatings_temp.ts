import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface Rating {
  id: number;
  job_application_id: number;
  recruiter_id: number;
  freelancer_id: number;
  rating: number;
  review?: string;
  status: "published" | "hidden" | "flagged";
  flags?: string[];
  admin_notes?: string;
  created_at: string;
  updated_at: string;
  recruiter: {
    id: number;
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
  job_title?: string;
}

export interface AverageRating {
  average: number;
  count: number;
}

export function useFreelancerRatings(freelancerId: number) {
  return useQuery({
    queryKey: ["/api/ratings/freelancer", freelancerId],
    queryFn: async (): Promise<Rating[]> => {
      const response = await apiRequest(`/api/ratings/freelancer/${freelancerId}`);
      return response;
    },
    enabled: !!freelancerId,
  });
}

export function useFreelancerAverageRating(freelancerId: number) {
  return useQuery({
    queryKey: ["/api/ratings/freelancer", freelancerId, "average"],
    queryFn: async (): Promise<AverageRating> => {
      const response = await apiRequest(`/api/ratings/freelancer/${freelancerId}/average`);
      return response;
    },
    enabled: !!freelancerId,
  });
}

export function useReportRating() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ ratingId, reason }: { ratingId: number; reason: string }) => {
      const response = await apiRequest(`/api/ratings/${ratingId}/report`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Report submitted",
        description: "Thank you for creating a safer community. We will review this report.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error reporting review",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });
}

export function useAdminRatings(status?: string) {
  return useQuery({
    queryKey: ["/api/admin/ratings", status],
    queryFn: async (): Promise<Rating[]> => {
      const url = status ? `/api/ratings/admin?status=${status}` : `/api/ratings/admin`;
      const response = await apiRequest(url);
      return response;
    },
  });
}

export function useModerationAction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      ratingId,
      action,
      notes,
    }: {
      ratingId: number;
      action: "hide" | "publish" | "flag";
      notes?: string;
    }) => {
      const response = await apiRequest(`/api/ratings/${ratingId}/moderate`, {
        method: "POST",
        body: JSON.stringify({ action, notes }),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ratings"] });
      toast({
        title: "Action successful",
        description: "Rating status updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating rating",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });
}
