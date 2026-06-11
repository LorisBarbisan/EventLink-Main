import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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
  getUserHeadline,
  isUserDeleted,
  Message,
} from "@/lib/utils/user";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MessageCircle, Send } from "lucide-react";

const URL_REGEX = /https?:\/\/[^\s<>"']+/g;

function renderWithLinks(content: string, isMyMessage: boolean) {
  const parts = content.split(URL_REGEX);
  const urls = content.match(URL_REGEX) || [];
  return parts.map((part, i) => (
    <span key={i}>
      {part}
      {urls[i] && (
        <a
          href={urls[i]}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline break-all ${isMyMessage ? "text-white/90 hover:text-white" : "text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"}`}
        >
          {urls[i]}
        </a>
      )}
    </span>
  ));
}

function ConversationAvatar({
  photoUrl,
  initials,
  size = "md",
  variant = "accent",
}: {
  photoUrl?: string | null;
  initials: string;
  size?: "sm" | "md" | "lg";
  variant?: "accent" | "primary";
}) {
  const sizeClass =
    size === "lg" ? "w-10 h-10 text-sm" : size === "sm" ? "w-7 h-7 text-xs" : "w-9 h-9 text-xs";
  // "accent" variant = other-user avatars (orange/primary), "primary" = own avatar (also orange)
  const colorClass = "bg-primary/20 text-primary";
  return (
    <div
      className={`${sizeClass} ${colorClass} rounded-full flex-shrink-0 flex items-center justify-center font-semibold overflow-hidden`}
    >
      {photoUrl ? (
        <img src={photoUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}

interface Props {
  initialConversationId?: number | null;
}

export function MessagingInterface({ initialConversationId }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { subscribe } = useWebSocket();
  const { toast } = useToast();
  const [selectedConversation, setSelectedConversation] = useState<number | null>(
    initialConversationId || null
  );
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialConversationId) setSelectedConversation(initialConversationId);
  }, [initialConversationId]);

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

  // Mark as read when opening a conversation
  useEffect(() => {
    if (!selectedConversation || messagesLoading || !user?.id) return;
    apiRequest(`/api/conversations/${selectedConversation}/mark-read`, { method: "PATCH" }).catch(
      () => {}
    );
    queryClient
      .refetchQueries({ queryKey: ["/api/conversations", selectedConversation, "messages"] })
      .catch(() => {});
    queryClient.refetchQueries({ queryKey: ["/api/conversations"] }).catch(() => {});
  }, [selectedConversation, messagesLoading, user?.id, queryClient]);

  // --- SEND MESSAGE MUTATION ---
  const sendMessageMutation = useMutation({
    mutationFn: async (payload: { conversation_id: number; content: string }) =>
      apiRequest("/api/messages", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: async () => {
      await queryClient.refetchQueries({
        queryKey: ["/api/conversations", selectedConversation, "messages"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", selectedConversation, "messages"],
      });
    },
    onError: (_err, variables) => {
      toast({ title: "Failed to send message", variant: "destructive" });
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
      const { message, sender } = data;
      const conversation_id = message?.conversation_id;
      if (!message || !sender) return;

      if (selectedConversation === conversation_id) {
        apiRequest(`/api/conversations/${conversation_id}/mark-read`, { method: "PATCH" }).catch(
          () => {}
        );
        queryClient
          .refetchQueries({ queryKey: ["/api/conversations", conversation_id, "messages"] })
          .catch(() => {});
      } else {
        queryClient.refetchQueries({ queryKey: ["/api/conversations"] }).catch(() => {});
      }
    });
    return unsubscribe;
  }, [subscribe, queryClient, selectedConversation]);

  // --- AUTO SCROLL ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const activeConv = conversations.find(c => c.id === selectedConversation);

  // --- JSX ---
  return (
    <div className="flex flex-col gap-0 h-[calc(100vh-180px)] min-h-[500px]">
      {/* Title bar — hidden when a conversation is open on mobile */}
      <div className={`flex items-center gap-2 mb-4 ${selectedConversation ? "hidden lg:flex" : "flex"}`}>
        <MessageCircle className="h-5 w-5" />
        <h1 className="text-2xl font-bold">Messages</h1>
      </div>

      <div className="flex flex-1 overflow-hidden rounded-xl border border-border shadow-sm bg-background">
        {/* ===== LEFT: Conversation list ===== */}
        <div
          className={`w-full lg:w-[320px] lg:min-w-[280px] flex-shrink-0 border-r border-border flex flex-col ${selectedConversation ? "hidden lg:flex" : "flex"}`}
        >
          <div className="px-4 py-3 border-b border-border">
            <p className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Conversations
            </p>
          </div>

          <ScrollArea className="flex-1">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-10 text-center text-muted-foreground">
                <MessageCircle className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm">No conversations yet</p>
              </div>
            ) : (
              conversations.map(c => {
                const isActive = selectedConversation === c.id;
                const isDeleted = isUserDeleted(c.otherUser);
                const unread = (c.unread_count ?? 0) > 0;
                const preview = c.last_message_preview;

                return (
                  <div key={c.id} className="border-b border-border/50 last:border-b-0">
                  <button
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-l-4 ${isDeleted ? "opacity-60" : ""}`}
                    style={
                      isActive
                        ? {
                            borderLeftColor: "hsl(var(--primary))",
                            backgroundColor: "hsl(var(--accent) / 0.15)",
                          }
                        : {
                            borderLeftColor: "transparent",
                            backgroundColor: "hsl(var(--primary) / 0.04)",
                          }
                    }
                    onMouseEnter={e => {
                      if (!isActive)
                        (e.currentTarget as HTMLElement).style.backgroundColor =
                          "hsl(var(--primary) / 0.07)";
                    }}
                    onMouseLeave={e => {
                      if (!isActive)
                        (e.currentTarget as HTMLElement).style.backgroundColor =
                          "hsl(var(--primary) / 0.04)";
                    }}
                    onClick={() => setSelectedConversation(c.id)}
                  >
                    <ConversationAvatar
                      photoUrl={c.otherUser.profile_photo_url}
                      initials={getAvatarInitials(c.otherUser)}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className={`text-sm truncate ${unread ? "font-semibold" : "font-medium"} ${isDeleted ? "text-muted-foreground" : ""}`}>
                          {getDisplayName(c.otherUser)}
                        </p>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {unread && (
                            <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                          )}
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                            {formatRelativeTime(c.last_message_at)}
                          </span>
                        </div>
                      </div>

                      {!isDeleted && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {getUserHeadline(c.otherUser)}
                        </p>
                      )}

                      {preview && (
                        <p className={`text-xs mt-1 truncate ${unread ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                          {preview}
                        </p>
                      )}
                    </div>
                  </button>
                  </div>
                );
              })
            )}
          </ScrollArea>
        </div>

        {/* ===== RIGHT: Chat area ===== */}
        <div className={`flex-1 flex flex-col overflow-hidden ${!selectedConversation ? "hidden lg:flex" : "flex"}`}>
          {/* Chat header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-8 w-8"
              onClick={() => setSelectedConversation(null)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            {activeConv ? (
              <>
                <ConversationAvatar
                  photoUrl={activeConv.otherUser.profile_photo_url}
                  initials={getAvatarInitials(activeConv.otherUser)}
                  size="lg"
                  variant="accent"
                />
                <div className="min-w-0">
                  <p className="font-semibold text-sm leading-tight truncate">
                    {getDisplayName(activeConv.otherUser)}
                  </p>
                  {!isUserDeleted(activeConv.otherUser) && (
                    <p className="text-xs text-muted-foreground truncate">
                      {getUserHeadline(activeConv.otherUser)}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MessageCircle className="h-5 w-5" />
                <span className="text-sm">Select a conversation</span>
              </div>
            )}
          </div>

          {/* Messages */}
          {selectedConversation ? (
            <>
              <ScrollArea className="flex-1 px-4 py-4">
                <div className="space-y-3">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <MessageCircle className="h-10 w-10 mb-3 opacity-40" />
                      <p className="text-sm">No messages yet. Say hello!</p>
                    </div>
                  ) : (
                    messages.map(msg => {
                      const isMyMessage = msg.sender_id === user?.id;
                      const isSystemMessage = msg.sender_id === null;

                      return (
                        <div
                          key={msg.id}
                          className={`flex items-end gap-2 ${
                            isSystemMessage
                              ? "justify-center"
                              : isMyMessage
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >
                          {!isMyMessage && !isSystemMessage && activeConv && (
                            <ConversationAvatar
                              photoUrl={activeConv.otherUser.profile_photo_url}
                              initials={getAvatarInitials(activeConv.otherUser)}
                              size="sm"
                              variant="accent"
                            />
                          )}
                          <div
                            className={`max-w-[68%] px-3 py-2 rounded-2xl text-sm ${
                              isSystemMessage
                                ? "bg-muted text-muted-foreground text-center text-xs px-4"
                                : isMyMessage
                                ? "bg-primary text-primary-foreground rounded-br-sm"
                                : "rounded-bl-sm"
                            }`}
                            style={
                              !isSystemMessage && !isMyMessage
                                ? {
                                    backgroundColor: "hsl(var(--accent) / 0.15)",
                                    color: "hsl(var(--foreground))",
                                  }
                                : undefined
                            }
                          >
                            <p className="break-words whitespace-pre-wrap leading-relaxed">
                              {renderWithLinks(msg.content, isMyMessage)}
                            </p>
                            <p
                              className={`text-[10px] mt-1 ${
                                isSystemMessage
                                  ? "text-muted-foreground"
                                  : isMyMessage
                                  ? "text-primary-foreground/70 text-right"
                                  : ""
                              }`}
                              style={
                                !isSystemMessage && !isMyMessage
                                  ? { color: "hsl(var(--accent) / 0.6)" }
                                  : undefined
                              }
                            >
                              {formatRelativeTime(msg.created_at)}
                            </p>
                          </div>
                          {isMyMessage && (
                            <ConversationAvatar
                              photoUrl={user?.profile_photo_url}
                              initials={
                                user
                                  ? (user.first_name?.[0] ?? "") + (user.last_name?.[0] ?? "") ||
                                    user.email?.substring(0, 2).toUpperCase() ||
                                    "Me"
                                  : "Me"
                              }
                              size="sm"
                              variant="primary"
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="px-4 py-3 border-t border-border bg-background">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Write a message..."
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="rounded-full bg-muted border-none focus-visible:ring-1"
                  />
                  <Button
                    size="icon"
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim()}
                    className="rounded-full h-9 w-9 flex-shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <MessageCircle className="h-16 w-16 mb-4 opacity-30" />
              <p className="text-base font-medium">Select a conversation to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
