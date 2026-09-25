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
          className={`break-all underline ${isMyMessage ? "text-white/90 hover:text-white" : "text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"}`}
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
}: {
  photoUrl?: string | null;
  initials: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "lg" ? "w-10 h-10 text-sm" : size === "sm" ? "w-7 h-7 text-xs" : "w-9 h-9 text-xs";
  const colorClass = "bg-primary/20 text-primary";
  return (
    <div
      className={`${sizeClass} ${colorClass} flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold`}
    >
      {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" /> : initials}
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

  // Track whether we're in the desktop two-pane layout (matches the `lg:` breakpoint).
  // Below this width the UI is single-pane, so we must not auto-open a conversation.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsDesktop(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

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

  // Auto-select the most recent conversation on first load — desktop only.
  // On mobile the messages tab must open on the conversation list, and selecting
  // null (via the back arrow) must keep it there instead of re-opening a chat.
  useEffect(() => {
    if (isDesktop && !initialConversationId && !selectedConversation && conversations.length > 0) {
      setSelectedConversation(conversations[0].id);
    }
  }, [isDesktop, conversations, initialConversationId, selectedConversation]);

  // Fetch own profile photo directly so it's always up-to-date
  const { data: ownProfile } = useQuery<{
    profile_photo_url?: string | null;
    company_logo_url?: string | null;
  }>({
    queryKey: ["/api/own-profile-photo", user?.id, user?.role],
    queryFn: () => {
      if (!user?.id) return Promise.resolve({});
      if (user.role === "freelancer") return apiRequest(`/api/freelancer/${user.id}`);
      if (user.role === "recruiter") return apiRequest(`/api/recruiter/${user.id}`);
      return Promise.resolve({});
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const ownPhotoUrl =
    ownProfile?.profile_photo_url ||
    ownProfile?.company_logo_url ||
    user?.profile_photo_url ||
    null;

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
    const unsubscribe = subscribe((data) => {
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
  // Scroll only the messages viewport to the latest message. Using scrollIntoView
  // here would scroll every scrollable ancestor (including the window), jumping the
  // whole page down past the header on mobile.
  useEffect(() => {
    const end = messagesEndRef.current;
    if (!end) return;
    const viewport = end.closest("[data-radix-scroll-area-viewport]") as HTMLElement | null;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [messages]);

  const activeConv = conversations.find((c) => c.id === selectedConversation);

  // --- JSX ---
  return (
    <div className="flex flex-col gap-0">
      {/* Title bar — hidden when a conversation is open on mobile */}
      <div
        className={`mb-4 flex items-center gap-2 ${selectedConversation ? "hidden lg:flex" : "flex"}`}
      >
        <MessageCircle className="h-5 w-5" />
        <h1 className="text-2xl font-bold">Messages</h1>
      </div>

      <div
        className="flex rounded-xl border border-border bg-background shadow-sm"
        style={{ minHeight: "200px" }}
      >
        {/* ===== LEFT: Conversation list ===== */}
        <div
          className={`flex w-full flex-shrink-0 flex-col border-r border-border lg:w-[320px] lg:min-w-[280px] ${selectedConversation ? "hidden lg:flex" : "flex"}`}
        >
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Conversations
            </p>
          </div>

          <ScrollArea className="max-h-[70vh]">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-10 text-center text-muted-foreground">
                <MessageCircle className="mb-3 h-10 w-10 opacity-40" />
                <p className="text-sm">No conversations yet</p>
              </div>
            ) : (
              conversations.map((c) => {
                const isActive = selectedConversation === c.id;
                const isDeleted = isUserDeleted(c.otherUser);
                const unread = (c.unread_count ?? 0) > 0;
                const preview = c.last_message_preview;

                return (
                  <div key={c.id} className="border-b border-border/50 last:border-b-0">
                    <button
                      className={`flex w-full items-start gap-3 border-l-4 px-4 py-3 text-left transition-colors ${isDeleted ? "opacity-60" : ""}`}
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
                      onMouseEnter={(e) => {
                        if (!isActive)
                          (e.currentTarget as HTMLElement).style.backgroundColor =
                            "hsl(var(--primary) / 0.07)";
                      }}
                      onMouseLeave={(e) => {
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

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-1">
                          <p
                            className={`truncate text-sm ${unread ? "font-semibold" : "font-medium"} ${isDeleted ? "text-muted-foreground" : ""}`}
                          >
                            {getDisplayName(c.otherUser)}
                          </p>
                          <div className="flex flex-shrink-0 items-center gap-1.5">
                            {unread && (
                              <span className="h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                            )}
                            <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                              {formatRelativeTime(c.last_message_at)}
                            </span>
                          </div>
                        </div>

                        {!isDeleted && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {getUserHeadline(c.otherUser)}
                          </p>
                        )}

                        {preview && (
                          <p
                            className={`mt-1 truncate text-xs ${unread ? "font-medium text-foreground" : "text-muted-foreground"}`}
                          >
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
        <div
          className={`flex min-w-0 flex-1 flex-col ${!selectedConversation ? "hidden lg:flex" : "flex"}`}
        >
          {/* Chat header */}
          <div className="flex items-center gap-3 border-b border-border bg-background px-4 py-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 lg:hidden"
              onClick={() => setSelectedConversation(null)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            {activeConv ? (
              <>
                {isUserDeleted(activeConv.otherUser) ? (
                  <div className="flex min-w-0 items-center gap-3">
                    <ConversationAvatar
                      photoUrl={activeConv.otherUser.profile_photo_url}
                      initials={getAvatarInitials(activeConv.otherUser)}
                      size="lg"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold leading-tight text-muted-foreground">
                        {getDisplayName(activeConv.otherUser)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <a
                    href={`/profile/${activeConv.otherUser.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex min-w-0 items-center gap-3"
                  >
                    <div className="transition-opacity group-hover:opacity-80">
                      <ConversationAvatar
                        photoUrl={activeConv.otherUser.profile_photo_url}
                        initials={getAvatarInitials(activeConv.otherUser)}
                        size="lg"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold leading-tight transition-colors group-hover:text-primary group-hover:underline">
                        {getDisplayName(activeConv.otherUser)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {getUserHeadline(activeConv.otherUser)}
                      </p>
                    </div>
                  </a>
                )}
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
              <ScrollArea className="max-h-[60vh] px-4 py-4">
                <div className="space-y-3">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <MessageCircle className="mb-3 h-10 w-10 opacity-40" />
                      <p className="text-sm">No messages yet. Say hello!</p>
                    </div>
                  ) : (
                    messages.map((msg) => {
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
                            />
                          )}
                          <div
                            className={`max-w-[68%] rounded-2xl px-3 py-2 text-sm ${
                              isSystemMessage
                                ? "bg-muted px-4 text-center text-xs text-muted-foreground"
                                : isMyMessage
                                  ? "rounded-br-sm bg-primary text-primary-foreground"
                                  : "rounded-bl-sm"
                            }`}
                            style={
                              !isSystemMessage && !isMyMessage
                                ? { backgroundColor: "rgb(254 243 199)", color: "rgb(120 53 15)" }
                                : undefined
                            }
                          >
                            <p className="whitespace-pre-wrap break-words leading-relaxed">
                              {renderWithLinks(msg.content, isMyMessage)}
                            </p>
                            <p
                              className={`mt-1 text-[10px] ${
                                isSystemMessage
                                  ? "text-muted-foreground"
                                  : isMyMessage
                                    ? "text-right text-primary-foreground/70"
                                    : ""
                              }`}
                              style={
                                !isSystemMessage && !isMyMessage
                                  ? { color: "rgb(180 83 9 / 0.7)" }
                                  : undefined
                              }
                            >
                              {formatRelativeTime(msg.created_at)}
                            </p>
                          </div>
                          {isMyMessage && (
                            <ConversationAvatar
                              photoUrl={ownPhotoUrl}
                              initials={
                                user
                                  ? (user.first_name?.[0] ?? "") + (user.last_name?.[0] ?? "") ||
                                    user.email?.substring(0, 2).toUpperCase() ||
                                    "Me"
                                  : "Me"
                              }
                              size="sm"
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
              <div className="border-t border-border bg-background px-4 py-3">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Write a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="rounded-full border-none bg-muted focus-visible:ring-1"
                  />
                  <Button
                    size="icon"
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim()}
                    className="h-9 w-9 flex-shrink-0 rounded-full"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <MessageCircle className="mb-4 h-16 w-16 opacity-30" />
              <p className="text-base font-medium">Select a conversation to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
