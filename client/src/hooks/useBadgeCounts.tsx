import { useQuery } from '@tanstack/react-query';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useEffect, useRef } from 'react';

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
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch badge counts from API
  const { data: counts = { messages: 0, applications: 0, jobs: 0, ratings: 0, total: 0 }, refetch } = useQuery<BadgeCounts>({
    queryKey: ['/api/notifications/category-counts', user?.id],
    queryFn: async (): Promise<BadgeCounts> => {
      if (!user?.id) return { messages: 0, applications: 0, jobs: 0, ratings: 0, total: 0 };
      
      try {
        const response = await fetch('/api/notifications/category-counts', {
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch badge counts');
        }
        
        return await response.json();
      } catch (error) {
        console.error('Error fetching badge counts:', error);
        return { messages: 0, applications: 0, jobs: 0, ratings: 0, total: 0 };
      }
    },
    enabled: enabled && !!user?.id,
    refetchInterval,
    refetchIntervalInBackground: false, // Stop polling when tab is inactive
  });

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!user?.id || !enabled) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Badge counts WebSocket connected');
        ws.send(JSON.stringify({ type: 'authenticate', userId: user.id }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'badge_counts_update') {
            console.log('Received badge counts update:', data.counts);
            // Refetch badge counts when we receive real-time updates
            refetch();
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('Badge counts WebSocket disconnected');
      };

      ws.onerror = (error) => {
        console.error('Badge counts WebSocket error:', error);
      };

      return () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
        wsRef.current = null;
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
    }
  }, [user?.id, enabled, refetch]);

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
      const response = await fetch(`/api/notifications/mark-category-read/${category}`, {
        method: 'PATCH',
        credentials: 'include'
      });

      if (response.ok) {
        // Refetch badge counts after marking as read
        refetch();
        console.log(`${category} notifications marked as read`);
      }
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