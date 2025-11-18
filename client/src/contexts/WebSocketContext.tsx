import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
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
  const { user } = useOptimizedAuth();
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

            console.log("📨 WebSocket message received:", data.type);
            // DEBUG: Log what we're about to send
            console.log("📨 [Client] WebSocket message received:", data);
            console.log("[WS] Incoming message=========================>:", data);

            // Notify all subscribers (they decide how to handle the message)
            subscribersRef.current.forEach(callback => {
              try {
                callback(data);
              } catch (error) {
                console.error("Error in WebSocket subscriber callback:", error);
              }
            });

            // Lightweight cache updates only - let subscribers handle heavy refetches
            switch (data.type) {
              case "new_message":
                // Invalidate conversations list to trigger refetch and show new messages
                // MessagingInterface will handle the actual refetch
                queryClient.invalidateQueries({
                  queryKey: ["/api/conversations"],
                  refetchType: "active", // Only refetch if query is active (component is mounted)
                });
                // Specific conversation messages will be refetched by MessagingInterface if active
                break;

              case "badge_counts_update":
                // Directly update cache with new counts (no refetch needed)
                if (data.counts) {
                  queryClient.setQueryData(
                    ["/api/notifications/category-counts", user.id],
                    data.counts
                  );
                }
                break;

              case "new_notification":
                // Only invalidate notification queries - let components refetch when needed
                queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
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
