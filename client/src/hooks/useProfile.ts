import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type {
  FreelancerFormData,
  FreelancerProfile,
  RecruiterFormData,
  RecruiterProfile,
} from "@shared/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface UseProfileProps {
  userId: number;
  userType: "freelancer" | "recruiter";
}

export function useProfile({ userId, userType }: UseProfileProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch profile - only when userId is valid
  const { data: profile, isLoading } = useQuery({
    queryKey: [`/api/${userType}`, userId],
    queryFn: async () => {
      try {
        return await apiRequest(`/api/${userType}/${userId}`);
      } catch (error: any) {
        // If 404, user doesn't have a profile yet (not an error)
        // This can happen if:
        // 1. User hasn't created a profile yet
        // 2. User is the wrong type (e.g., freelancer but fetching recruiter profile)
        if (
          error?.status === 404 ||
          error?.message?.includes("404") ||
          error?.message?.includes("not found")
        ) {
          console.log(
            `No ${userType} profile found for user ${userId} (this is normal if profile hasn't been created yet or user is wrong type)`
          );
          return null;
        }
        throw error;
      }
    },
    enabled: userId > 0, // Only fetch when we have a valid user ID
    retry: false,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (profileData: FreelancerFormData | RecruiterFormData) => {
      console.log("useProfile updateMutation - sending data to API:", profileData);
      if (userType === "recruiter") {
        console.log(
          "Recruiter data company_logo_url length:",
          (profileData as RecruiterFormData).company_logo_url?.length
        );
      }
      return await apiRequest(`/api/${userType}/${userId}`, {
        method: "PUT",
        body: JSON.stringify({ user_id: userId, ...profileData }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/${userType}`, userId] });
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update profile.",
        variant: "destructive",
      });
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (profileData: FreelancerFormData | RecruiterFormData) => {
      console.log("useProfile createMutation - sending data to API:", profileData);
      if (userType === "recruiter") {
        console.log(
          "Recruiter create data company_logo_url length:",
          (profileData as RecruiterFormData).company_logo_url?.length
        );
      }
      return await apiRequest(`/api/${userType}`, {
        method: "POST",
        body: JSON.stringify({ user_id: userId, ...profileData }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: (newProfile) => {
      // Invalidate and refetch to get the newly created profile
      queryClient.invalidateQueries({ queryKey: [`/api/${userType}`, userId] });
      queryClient.refetchQueries({ queryKey: [`/api/${userType}`, userId] });
      toast({
        title: "Profile created",
        description: "Your profile has been created successfully.",
      });
    },
    onError: (error) => {
      console.error("Profile creation error:", error);
      toast({
        title: "Error",
        description: "Failed to create profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const saveProfile = async (data: FreelancerFormData | RecruiterFormData) => {
    if (profile) {
      await updateMutation.mutateAsync(data);
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  return {
    profile: profile as FreelancerProfile | RecruiterProfile | undefined,
    isLoading,
    saveProfile,
    isSaving: updateMutation.isPending || createMutation.isPending,
  };
}
