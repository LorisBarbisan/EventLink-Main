import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type WebSocketEventCallback = (data: any) => void;

interface WebSocketContextValue {
  send: (data: any) => void;
  isConnected: boolean;
  subscribe: (callback: WebSocketEventCallback) => () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

interface WebSocketProviderProps {
  children: ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const subscribersRef = useRef<Set<WebSocketEventCallback>>(new Set());
  const processedMessagesRef = useRef<Set<string>>(new Set());

  const send = (data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      console.warn("WebSocket not connected, message not sent:", data);
    }
  };

  const subscribe = useCallback((callback: WebSocketEventCallback) => {
    subscribersRef.current.add(callback);
    return () => {
      subscribersRef.current.delete(callback);
    };
  }, []);

  useEffect(() => {
    if (!user?.id) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const connect = () => {
      try {
        console.log("🔌 Establishing centralized WebSocket connection...");
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("✅ WebSocket connected");
          setIsConnected(true);

          // Authenticate with user ID
          ws.send(JSON.stringify({ type: "authenticate", userId: user.id }));
        };

        ws.onmessage = async event => {
          try {
            const data = JSON.parse(event.data);

            // Only deduplicate notifications (which have stable IDs)
            // new_message events should always be processed (each message is unique)
            if (data.type === "new_notification" && data.notification?.id) {
              const notificationId = `notification-${data.notification.id}`;

              // Skip if we've already processed this notification
              if (processedMessagesRef.current.has(notificationId)) {
                return;
              }
              processedMessagesRef.current.add(notificationId);

              // Cleanup old processed notification IDs (keep only last 100)
              if (processedMessagesRef.current.size > 100) {
                const entries = Array.from(processedMessagesRef.current);
                processedMessagesRef.current = new Set(entries.slice(-100));
              }
            }

            // Notify all subscribers (they decide how to handle the message)
            subscribersRef.current.forEach(callback => {
              try {
                callback(data);
              } catch (error) {
                console.error("Error in WebSocket subscriber callback:", error);
              }
            });

            switch (data.type) {
              case "new_message":
                queryClient.invalidateQueries({
                  queryKey: ["/api/conversations"],
                  refetchType: "active",
                });
                break;

              case "badge_counts_update":
                if (data.counts) {
                  let updatedCounts = { ...data.counts };
                  const currentPath = window.location.pathname;
                  const currentHash = window.location.hash;

                  // Intercept and suppress counts for active admin tabs
                  // Use robust path matching to handle trailing slashes or base path variations
                  if (currentPath.replace(/\/$/, "") === "/admin") {
                    if (currentHash === "#feedback" && updatedCounts.feedback > 0) {
                      console.log("🛡️ [WebSocket] Suppressing feedback count for active tab");
                      updatedCounts.total -= updatedCounts.feedback;
                      updatedCounts.feedback = 0;
                    } else if (
                      (currentHash === "#contact" || currentHash === "#contact-messages") &&
                      updatedCounts.contact_messages > 0
                    ) {
                      console.log("🛡️ [WebSocket] Suppressing contact count for active tab");
                      updatedCounts.total -= updatedCounts.contact_messages;
                      updatedCounts.contact_messages = 0;
                    }
                  }

                  console.log("📊 [WebSocket] Updating badge counts:", updatedCounts);
                  queryClient.setQueryData(
                    ["/api/notifications/category-counts", user.id],
                    updatedCounts
                  );

                  const totalUnread = (updatedCounts as { total?: number }).total ?? 0;
                  queryClient.setQueryData(
                    ["/api/notifications/unread-count", user.id],
                    totalUnread
                  );
                }
                break;

              case "new_notification":
                queryClient.invalidateQueries({
                  queryKey: ["/api/notifications", user.id],
                  refetchType: "active",
                });

                break;

              case "notification_updated":
                queryClient.invalidateQueries({
                  queryKey: ["/api/notifications", user.id],
                  refetchType: "active",
                });
                break;

              case "all_notifications_updated":
                queryClient.invalidateQueries({
                  queryKey: ["/api/notifications", user.id],
                  refetchType: "active",
                });
                break;
              case "new_contact_message":
                queryClient.invalidateQueries({
                  queryKey: ["/api/admin/contact-messages"],
                  refetchType: "active",
                });
                // Instant read-mark if on the tab
                if (
                  window.location.pathname.replace(/\/$/, "") === "/admin" &&
                  (window.location.hash === "#contact" ||
                    window.location.hash === "#contact-messages")
                ) {
                  apiRequest("/api/notifications/mark-category-read/contact_messages", {
                    method: "PATCH",
                  }).catch(() => {});
                }
                break;
              case "new_feedback":
                console.log("📝 [WebSocket] Received new_feedback event, invalidating queries...");
                queryClient.invalidateQueries({
                  queryKey: ["/api/admin/feedback"],
                });
                queryClient.invalidateQueries({
                  queryKey: ["/api/admin/feedback/stats"],
                });
                // Instant read-mark if on the tab
                if (
                  window.location.pathname.replace(/\/$/, "") === "/admin" &&
                  window.location.hash === "#feedback"
                ) {
                  apiRequest("/api/notifications/mark-category-read/feedback", {
                    method: "PATCH",
                  }).catch(() => {});
                }
                break;
              default:
                break;
            }
          } catch (error) {
            console.error("Error parsing WebSocket message:", error);
          }
        };

        ws.onclose = () => {
          console.log("🔌 WebSocket disconnected");
          setIsConnected(false);
          wsRef.current = null;

          // Attempt to reconnect after 3 seconds if user is still logged in
          if (user?.id) {
            console.log("🔄 Reconnecting in 3 seconds...");
            reconnectTimeoutRef.current = setTimeout(connect, 3000);
          }
        };

        ws.onerror = error => {
          console.error("❌ WebSocket error:", error);
        };
      } catch (error) {
        console.error("Error creating WebSocket connection:", error);
      }
    };

    connect();

    return () => {
      // Cleanup on unmount or user change
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
        setIsConnected(false);
      }
    };
  }, [user?.id, queryClient, subscribe]);

  const value: WebSocketContextValue = {
    send,
    isConnected,
    subscribe,
  };

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
}
