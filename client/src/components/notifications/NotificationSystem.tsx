import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Notification } from "@shared/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import NotificationHeader from "./NotificationHeader";
import NotificationItem from "./NotificationItem";

interface NotificationSystemProps {
  userId: number;
}

export function NotificationSystem({ userId }: NotificationSystemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notifications - always enabled so refetches work
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["/api/notifications", userId],
    queryFn: () => apiRequest("/api/notifications") as Promise<Notification[]>,
    staleTime: 0,
    refetchInterval: false,
    refetchOnWindowFocus: true,
  });

  // Fetch unread count with smart polling
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["/api/notifications/unread-count", userId],
    queryFn: async () => {
      const data = await apiRequest("/api/notifications/unread-count");
      return data.count;
    },
    staleTime: 0,
    refetchInterval: false,
    refetchIntervalInBackground: false, // Stop when tab is inactive
    refetchOnWindowFocus: true, // Always refetch when component mounts
  });

  // Mark notification as read - rely on server response and WebSocket for updates
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      return apiRequest(`/api/notifications/${notificationId}/read`, {
        method: "PATCH",
      });
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["/api/notifications", userId] });
      await queryClient.refetchQueries({ queryKey: ["/api/notifications/unread-count", userId] });
      await queryClient.refetchQueries({
        queryKey: ["/api/notifications/category-counts", userId],
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark notification as read",
        variant: "destructive",
      });
    },
  });

  // Mark all notifications as read - rely on WebSocket for updates
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/notifications/mark-all-read", {
        method: "PATCH",
      });
    },
    onSuccess: async () => {
      toast({
        title: "Success",
        description: "All notifications marked as read",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark all notifications as read",
        variant: "destructive",
      });
    },
  });

  // Delete notification
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      return apiRequest(`/api/notifications/${notificationId}`, {
        method: "DELETE",
      });
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["/api/notifications", userId] });
      await queryClient.refetchQueries({ queryKey: ["/api/notifications/unread-count", userId] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete notification",
        variant: "destructive",
      });
    },
  });

  const [, setLocation] = useLocation();

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsReadMutation.mutateAsync(notification.id);
    }

    setIsOpen(false);

    // Navigate to action URL if provided
    if (notification.action_url) {
      // Use client-side routing for internal URLs to preserve app state
      if (notification.action_url.startsWith("/")) {
        setLocation(notification.action_url);
      } else {
        // External URLs open in new tab
        window.open(notification.action_url, "_blank");
      }
    }
  };

  const unreadNotifications = notifications.filter(n => !n.is_read);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Subscribe to WebSocket events for instant notification updates
  const { subscribe } = useWebSocket();

  useEffect(() => {
    if (!userId) return;

    const subscribeWS = subscribe(data => {
      switch (data.type) {
        case "new_notification":
          queryClient.invalidateQueries({ queryKey: ["/api/notifications", userId] });
          break;

        case "badge_counts_update":
          queryClient.invalidateQueries({
            queryKey: ["/api/notifications/unread-count", userId],
          });
          break;

        case "all_notifications_updated":
          queryClient.invalidateQueries({
            queryKey: ["/api/notifications", userId],
          });
          break;
      }
    });

    return subscribeWS;
  }, [userId, subscribe, queryClient]);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
        data-testid="button-notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 w-5 text-xs p-0 flex items-center justify-center"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-2 w-96 bg-white border rounded-lg shadow-lg z-50"
        >
          <Card className="border-0 shadow-none">
            <NotificationHeader
              unreadCount={unreadNotifications.length}
              onMarkAllRead={() => markAllAsReadMutation.mutate()}
              isMarkingAll={markAllAsReadMutation.isPending}
              onClose={() => setIsOpen(false)}
            />
            <Separator />

            <CardContent className="p-0">
              <ScrollArea className="h-96">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-sm text-muted-foreground">Loading notifications...</div>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No notifications yet</p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y">
                    {notifications.map(n => (
                      <NotificationItem
                        key={n.id}
                        notification={n}
                        onMarkRead={() => markAsReadMutation.mutate(n.id)}
                        onDelete={() => deleteNotificationMutation.mutate(n.id)}
                        onClick={() => handleNotificationClick(n)}
                        isMarkAsReadDisabled={markAsReadMutation.isPending}
                        isDeleteDisabled={deleteNotificationMutation.isPending}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
