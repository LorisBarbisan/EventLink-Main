import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface BadgeCounts {
  messages: number;
  applications: number;
  jobs: number;
  ratings: number;
  total: number;
}

interface UseBadgeCountsProps {
  enabled?: boolean;
  refetchInterval?: number;
}

export function useBadgeCounts({
  enabled = true,
  refetchInterval = 1500,
}: UseBadgeCountsProps = {}) {
  const { user } = useOptimizedAuth();
  const queryClient = useQueryClient();

  // Fetch badge counts from API
  const {
    data: counts = { messages: 0, applications: 0, jobs: 0, ratings: 0, total: 0 },
    refetch,
  } = useQuery<BadgeCounts>({
    queryKey: ["/api/notifications/category-counts", user?.id],
    queryFn: async (): Promise<BadgeCounts> => {
      if (!user?.id) return { messages: 0, applications: 0, jobs: 0, ratings: 0, total: 0 };

      try {
        return await apiRequest("/api/notifications/category-counts");
      } catch (error) {
        console.error("Error fetching badge counts:", error);
        return { messages: 0, applications: 0, jobs: 0, ratings: 0, total: 0 };
      }
    },
    enabled: enabled && !!user?.id,
    staleTime: 0, // CRITICAL: Override default 5-minute staleTime to ensure instant updates
    refetchInterval: false, // Disable polling - rely entirely on WebSocket for real-time updates
    // Polling causes race conditions with WebSocket updates, leading to double counts
    refetchIntervalInBackground: false, // Stop polling when tab is inactive
    refetchOnMount: "always", // Always refetch when component mounts
  });

  // Note: Real-time badge count updates are now handled by the centralized WebSocketContext
  // which automatically updates badge counts when badge_counts_update events are received

  // Get role-specific counts
  const getRoleSpecificCounts = () => {
    if (!user) return {};

    if (user.role === "freelancer") {
      return {
        applications: counts.applications,
        messages: counts.messages,
        ratings: counts.ratings,
      };
    } else if (user.role === "recruiter") {
      return {
        jobs: counts.jobs,
        applications: counts.applications,
        messages: counts.messages,
        ratings: counts.ratings,
      };
    }

    return {};
  };

  // Function to mark category notifications as read
  const markCategoryAsRead = async (category: "messages" | "applications" | "jobs" | "ratings") => {
    if (!user?.id) return;

    try {
      await apiRequest(`/api/notifications/mark-category-read/${category}`, {
        method: "PATCH",
      });

      // Optimistically update badge counts immediately (set to 0 for the category)
      // This provides instant UI feedback while WebSocket confirms the update
      queryClient.setQueryData<BadgeCounts>(
        ["/api/notifications/category-counts", user.id],
        (old = { messages: 0, applications: 0, jobs: 0, ratings: 0, total: 0 }) => {
          const updated = {
            ...old,
            [category]: 0,
            total: Math.max(0, old.total - (old[category] || 0)),
          };
          console.log(`✅ Optimistically updated badge counts for ${category}:`, updated);
          return updated;
        }
      );

      // Also refetch to ensure we have the latest from server
      refetch();
    } catch (error) {
      console.error(`Error marking ${category} notifications as read:`, error);
    }
  };

  return {
    counts,
    roleSpecificCounts: getRoleSpecificCounts(),
    refetch,
    total: counts.total,
    markCategoryAsRead,
  };
}
