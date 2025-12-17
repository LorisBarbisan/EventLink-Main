import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { formatRelativeTime } from "@/lib/utils/FormatRelativeTime";
import {
  Conversation,
  getAvatarInitials,
  getDisplayName,
  isUserDeleted,
  Message,
} from "@/lib/utils/user";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, MessageCircle, Send, User as UserIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// --- COMPONENT ---
export function MessagingInterface() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { subscribe } = useWebSocket();
  const { toast } = useToast();
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- FETCH CONVERSATIONS ---
  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
    queryFn: () => apiRequest("/api/conversations"),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // --- FETCH MESSAGES ---
  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/conversations", selectedConversation, "messages"],
    queryFn: () => apiRequest(`/api/conversations/${selectedConversation}/messages`),
    enabled: !!selectedConversation,
    staleTime: 0,
    refetchInterval: false,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });

  // When opening a conversation, ensure server-marked read state is reflected via server & websocket
  useEffect(() => {
    if (!selectedConversation || messagesLoading || !user?.id) return;

    // Tell the server to mark all messages in this conversation as read; server will broadcast updated counts/notifications
    apiRequest(`/api/conversations/${selectedConversation}/mark-read`, {
      method: "PATCH",
    }).catch(err => {
      console.error("Failed to mark conversation messages as read:", err);
    });

    // Rely on server state: refetch messages and conversations rather than mutating cache directly
    queryClient
      .refetchQueries({ queryKey: ["/api/conversations", selectedConversation, "messages"] })
      .catch(() => {});
    queryClient.refetchQueries({ queryKey: ["/api/conversations"] }).catch(() => {});
  }, [selectedConversation, messagesLoading, user?.id, queryClient]);

  // --- SEND MESSAGE MUTATION ---
  const sendMessageMutation = useMutation({
    mutationFn: async (payload: { conversation_id: number; content: string }) =>
      apiRequest("/api/messages", {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    onSuccess: async () => {
      await queryClient.refetchQueries({
        queryKey: ["/api/conversations", selectedConversation, "messages"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", selectedConversation, "messages"],
      });
    },
    onError: (_err, variables) => {
      toast({
        title: "Failed to send message",
        variant: "destructive",
      });
      // restore content back to text box
      setNewMessage(variables.content);
    },
  });

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedConversation) return;
    const payload = { conversation_id: selectedConversation, content: newMessage.trim() };
    setNewMessage("");
    sendMessageMutation.mutate(payload);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // --- WEBSOCKET SUBSCRIPTION ---
  useEffect(() => {
    const unsubscribe = subscribe(data => {
      if (data.type !== "new_message") return;

      const { conversation_id, message, sender } = data;

      if (!message || !sender) return;

      console.log(
        `🔔 [WebSocket] Received new_message for conversation ${conversation_id}, message ID: ${message.id}`
      );

      // If the user is viewing this conversation, ask the server to mark it read and refetch messages.
      // We do NOT mutate the local cache directly; we rely on server responses / websocket broadcasts to update UI state.
      if (selectedConversation === conversation_id) {
        apiRequest(`/api/conversations/${conversation_id}/mark-read`, {
          method: "PATCH",
        }).catch(err => {
          console.error("Failed to mark conversation messages as read on incoming message:", err);
        });

        queryClient
          .refetchQueries({ queryKey: ["/api/conversations", conversation_id, "messages"] })
          .catch(() => {});
      } else {
        // Not viewing this conversation: refetch conversations so last_message_at and unread counts reflect server state
        queryClient.refetchQueries({ queryKey: ["/api/conversations"] }).catch(() => {});
      }
    });

    return unsubscribe;
  }, [subscribe, queryClient, selectedConversation]);

  // --- AUTO SCROLL ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- JSX RENDERING ---
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5" />
        <h1 className="text-2xl font-bold">Messages</h1>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* --- Conversations List --- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5" />
              Conversations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p>No conversations yet</p>
                </div>
              ) : (
                conversations.map(c => {
                  const isDeleted = isUserDeleted(c.otherUser);
                  return (
                    <div
                      key={c.id}
                      className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selectedConversation === c.id ? "bg-primary/10 border-primary" : "hover:bg-muted"} ${isDeleted ? "opacity-60" : ""}`}
                      onClick={() => setSelectedConversation(c.id)}
                    >
                      <Avatar className={isDeleted ? "opacity-50" : ""}>
                        <AvatarFallback>{getAvatarInitials(c.otherUser)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={`font-medium truncate ${isDeleted ? "text-muted-foreground" : ""}`}
                          >
                            {getDisplayName(c.otherUser)}
                          </p>
                          {isDeleted && <Badge variant="secondary">Deleted</Badge>}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">
                            {formatRelativeTime(c.last_message_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* --- Chat Area --- */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {selectedConversation ? (
                <>
                  <UserIcon className="h-5 w-5" />
                  <span>
                    {conversations.find(c => c.id === selectedConversation)?.otherUser.email ||
                      "Chat"}
                  </span>
                </>
              ) : (
                <>
                  <MessageCircle className="h-5 w-5" /> Select a conversation
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col h-[500px]">
            {selectedConversation ? (
              <>
                <ScrollArea className="flex-1 mb-4 pr-4">
                  <div className="space-y-4">
                    {messagesLoading ? (
                      <div className="flex items-center justify-center p-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-8 text-center">
                        <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
                        <p>No messages yet</p>
                      </div>
                    ) : (
                      messages.map(msg => {
                        const isMyMessage = msg.sender_id === user?.id;
                        const isSystemMessage = msg.sender_id === null;

                        return (
                          <div
                            key={msg.id}
                            className={`flex ${isSystemMessage ? "justify-center" : isMyMessage ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[70%] p-3 rounded-lg ${isSystemMessage ? "bg-muted text-muted-foreground text-center text-sm" : isMyMessage ? "bg-blue-500 text-white rounded-br-none" : "bg-gray-200 dark:bg-gray-700 text-foreground rounded-bl-none"}`}
                            >
                              <p className="break-words">{msg.content}</p>
                              <p
                                className={`text-xs mt-1 ${isSystemMessage ? "text-muted-foreground" : isMyMessage ? "text-white/70" : "text-muted-foreground"}`}
                              >
                                {formatRelativeTime(msg.created_at)}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                  />
                  <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
                    {" "}
                    <Send className="h-4 w-4 mr-2" /> Send{" "}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageCircle className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-muted-foreground">Select a conversation</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
