import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { useToast } from "@/hooks/use-toast";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { apiRequest } from "@/lib/queryClient";
import { formatDate } from "@/lib/utils/format-date";
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
  const { user } = useOptimizedAuth();
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
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  // --- SEND MESSAGE MUTATION ---
  const sendMessageMutation = useMutation({
    mutationFn: async (payload: { conversation_id: number; content: string }) =>
      apiRequest("/api/messages", {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    onError: (_err, variables) => {
      toast({
        title: "Failed to send message",
        variant: "destructive",
      });
      // restore content back to text box
      setNewMessage(variables.content);
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", selectedConversation, "messages"],
      });
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

      const newMessage: Message = {
        id: message.id,
        conversation_id,
        sender_id: message.sender_id,
        content: message.content,
        is_read: message.is_read || false,
        is_system_message: message.is_system_message || false,
        created_at: message.created_at,
        sender: {
          id: sender.id,
          email: sender.email,
          role: sender.role,
          deleted_at: sender.deleted_at || null,
          first_name: sender.first_name || null,
          last_name: sender.last_name || null,
          company_name: sender.company_name || null,
        },
      };

      queryClient.setQueryData<Message[]>(
        ["/api/conversations", conversation_id, "messages"],
        old => {
          if (!old) return [newMessage];

          const exists = old.some(m => m.id === newMessage.id);
          if (exists) return old;

          return [...old, newMessage];
        }
      );

      queryClient.setQueryData<Conversation[]>(["/api/conversations"], old =>
        old?.map(c =>
          c.id === conversation_id ? { ...c, last_message_at: newMessage.created_at } : c
        )
      );
    });

    return unsubscribe;
  }, [subscribe, queryClient]);

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
                            {formatDate(c.last_message_at)}
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
                                {formatDate(msg.created_at)}
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
