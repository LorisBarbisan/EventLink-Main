import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface UseTabNotificationsProps {
  userId: number | null | undefined;
  enabled?: boolean;
}

export function useTabNotifications({ userId, enabled = true }: UseTabNotificationsProps) {
  const originalTitleRef = useRef<string>("EventLink");
  // Removed polling interval state - no longer needed since we use WebSocket
  const lastCountRef = useRef(0);

  // Fetch unread count - rely on WebSocket for real-time updates, not polling
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["/api/notifications/unread-count", userId],
    queryFn: async (): Promise<number> => {
      if (!userId) return 0;
      try {
        const data = await apiRequest(`/api/notifications/unread-count`);
        return data.count as number;
      } catch {
        return 0;
      }
    },
    staleTime: 0, // CRITICAL: Override default 5-minute staleTime to ensure instant updates
    refetchInterval: false, // Disable polling - rely entirely on WebSocket for real-time updates
    // Polling causes race conditions with WebSocket updates, leading to double counts
    refetchIntervalInBackground: false, // Stop polling when tab is inactive
    refetchOnMount: "always", // Always refetch when component mounts
    enabled: enabled && !!userId,
  });

  // Track count changes for title updates (polling removed - WebSocket handles updates)
  useEffect(() => {
    const count = unreadCount as number;
    lastCountRef.current = count;
  }, [unreadCount]);

  // Update document title when unread count changes
  useEffect(() => {
    if (!enabled || !userId) return;

    // Store the original title on first load
    if (
      originalTitleRef.current === "EventLink" &&
      document.title &&
      document.title !== "EventLink"
    ) {
      originalTitleRef.current = document.title;
    }

    // Update title based on unread count
    if (unreadCount > 0) {
      document.title = `(${unreadCount > 99 ? "99+" : unreadCount}) ${originalTitleRef.current}`;
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
