import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

interface UseTabNotificationsProps {
  userId: number | null | undefined;
  enabled?: boolean;
}

export function useTabNotifications({ userId, enabled = true }: UseTabNotificationsProps) {
  const originalTitleRef = useRef<string>('EventLink');
  const [pollingInterval, setPollingInterval] = useState(15000); // Start with 15s
  const lastCountRef = useRef(0);
  
  // Fetch unread count using smart polling strategy
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['/api/notifications/unread-count', userId],
    queryFn: async (): Promise<number> => {
      if (!userId) return 0;
      const response = await fetch(`/api/notifications/unread-count?userId=${userId}`);
      if (!response.ok) return 0;
      const data = await response.json();
      return data.count as number;
    },
    refetchInterval: pollingInterval,
    refetchIntervalInBackground: false, // Stop polling when tab is inactive
    enabled: enabled && !!userId,
  });

  // Smart polling: adapt frequency based on activity (using useEffect instead of onSuccess)
  useEffect(() => {
    const count = unreadCount as number;
    if (count > lastCountRef.current) {
      // New notifications - poll more frequently
      setPollingInterval(10000);
    } else if (count === 0) {
      // No notifications - poll less frequently
      setPollingInterval(30000);
    } else {
      // Stable count - moderate polling
      setPollingInterval(15000);
    }
    lastCountRef.current = count;
  }, [unreadCount]);

  // Update document title when unread count changes
  useEffect(() => {
    if (!enabled || !userId) return;
    
    // Store the original title on first load
    if (originalTitleRef.current === 'EventLink' && document.title && document.title !== 'EventLink') {
      originalTitleRef.current = document.title;
    }
    
    // Update title based on unread count
    if (unreadCount > 0) {
      document.title = `(${unreadCount > 99 ? '99+' : unreadCount}) ${originalTitleRef.current}`;
    } else {
      document.title = originalTitleRef.current;
    }
    
    // Cleanup: restore original title when component unmounts
    return () => {
      document.title = originalTitleRef.current;
    };
  }, [unreadCount, enabled, userId]);

  // Optional: Add favicon notification badge (browser permitting)
  useEffect(() => {
    if (!enabled || !userId) return;
    
    // Try to find existing favicon
    const existingFavicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    
    if (unreadCount > 0 && existingFavicon) {
      // Add a simple red dot or indicator to favicon if possible
      // Note: This is limited by browser support and would require canvas manipulation
      // For now, we'll focus on the title notification which is universal
    }
  }, [unreadCount, enabled, userId]);

  return {
    unreadCount,
    hasNotifications: unreadCount > 0,
  };
}