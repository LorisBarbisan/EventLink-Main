import { useQuery } from '@tanstack/react-query';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { apiRequest } from '@/lib/queryClient';

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

export function useBadgeCounts({ enabled = true, refetchInterval = 15000 }: UseBadgeCountsProps = {}) {
  const { user } = useOptimizedAuth();

  // Fetch badge counts from API
  const { data: counts = { messages: 0, applications: 0, jobs: 0, ratings: 0, total: 0 }, refetch } = useQuery<BadgeCounts>({
    queryKey: ['/api/notifications/category-counts', user?.id],
    queryFn: async (): Promise<BadgeCounts> => {
      if (!user?.id) return { messages: 0, applications: 0, jobs: 0, ratings: 0, total: 0 };
      
      try {
        return await apiRequest('/api/notifications/category-counts');
      } catch (error) {
        console.error('Error fetching badge counts:', error);
        return { messages: 0, applications: 0, jobs: 0, ratings: 0, total: 0 };
      }
    },
    enabled: enabled && !!user?.id,
    refetchInterval,
    refetchIntervalInBackground: false, // Stop polling when tab is inactive
  });

  // Note: Real-time badge count updates are now handled by the centralized WebSocketContext
  // which automatically updates badge counts when badge_counts_update events are received

  // Get role-specific counts
  const getRoleSpecificCounts = () => {
    if (!user) return {};

    if (user.role === 'freelancer') {
      return {
        applications: counts.applications,
        messages: counts.messages,
        ratings: counts.ratings,
      };
    } else if (user.role === 'recruiter') {
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
  const markCategoryAsRead = async (category: 'messages' | 'applications' | 'jobs' | 'ratings') => {
    if (!user?.id) return;

    try {
      await apiRequest(`/api/notifications/mark-category-read/${category}`, {
        method: 'PATCH',
      });
      
      // Refetch badge counts after marking as read
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