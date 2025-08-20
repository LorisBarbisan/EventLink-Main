import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, MessageCircle, Clock, User } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface User {
  id: number;
  email: string;
  role: 'freelancer' | 'recruiter';
}

interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  is_read: boolean;
  created_at: string;
  sender: User;
}

interface Conversation {
  id: number;
  participant_one_id: number;
  participant_two_id: number;
  last_message_at: string;
  created_at: string;
  otherUser: User;
}

interface MessagingInterfaceProps {
  currentUser: User;
}

export function MessagingInterface({ currentUser }: MessagingInterfaceProps) {
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch conversations
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery({
    queryKey: ['/api/conversations', currentUser.id],
    queryFn: () => apiRequest(`/api/conversations?userId=${currentUser.id}`),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch messages for selected conversation
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['/api/conversations', selectedConversation, 'messages'],
    queryFn: async () => {
      if (!selectedConversation) return Promise.resolve([]);
      
      const result = await apiRequest(`/api/conversations/${selectedConversation}/messages?userId=${currentUser.id}`);
      
      // Invalidate unread count after messages are fetched (and marked as read on backend)
      queryClient.invalidateQueries({ queryKey: ['/api/messages/unread-count', currentUser.id] });
      
      return result;
    },
    enabled: !!selectedConversation,
  });

  // Fetch unread message count
  const { data: unreadCount = { count: 0 } } = useQuery({
    queryKey: ['/api/messages/unread-count', currentUser.id],
    queryFn: () => apiRequest(`/api/messages/unread-count?userId=${currentUser.id}`),
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: { conversation_id: number; sender_id: number; content: string }) => {
      return apiRequest('/api/messages', {
        method: 'POST',
        body: JSON.stringify(messageData),
      });
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ['/api/conversations', selectedConversation, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations', currentUser.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages/unread-count', currentUser.id] });
    },
  });

  // WebSocket setup
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      ws.send(JSON.stringify({ type: 'authenticate', userId: currentUser.id }));
      setWebsocket(ws);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'new_message') {
          // Invalidate queries to refetch new messages
          queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
          queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setWebsocket(null);
    };

    return () => {
      ws.close();
    };
  }, [currentUser.id, queryClient]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation) return;

    sendMessageMutation.mutate({
      conversation_id: selectedConversation,
      sender_id: currentUser.id,
      content: newMessage.trim(),
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  if (conversationsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <MessageCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
      {/* Conversations List */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Messages
            {unreadCount.count > 0 && (
              <Badge variant="destructive" className="ml-auto">
                {unreadCount.count}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            {conversations.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                <MessageCircle className="h-8 w-8 mx-auto mb-2" />
                <p>No conversations yet</p>
              </div>
            ) : (
              <div className="space-y-2 p-4">
                {conversations.map((conversation: Conversation) => (
                  <div
                    key={conversation.id}
                    onClick={() => setSelectedConversation(conversation.id)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedConversation === conversation.id
                        ? 'bg-primary/10 border-primary border'
                        : 'hover:bg-muted/50'
                    }`}
                    data-testid={`conversation-${conversation.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-gradient-primary text-white">
                          {conversation.otherUser.email.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {conversation.otherUser.email}
                        </p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {conversation.otherUser.role}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(conversation.last_message_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Chat Area */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {selectedConversation ? (
              <>
                <User className="h-5 w-5" />
                {conversations.find((c: Conversation) => c.id === selectedConversation)?.otherUser.email || 'Chat'}
              </>
            ) : (
              <>
                <MessageCircle className="h-5 w-5" />
                Select a conversation
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col h-[500px]">
          {selectedConversation ? (
            <>
              {/* Messages */}
              <ScrollArea className="flex-1 mb-4">
                <div className="space-y-4 p-4">
                  {messagesLoading ? (
                    <div className="text-center text-muted-foreground">
                      <Clock className="h-6 w-6 mx-auto mb-2" />
                      Loading messages...
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-muted-foreground">
                      <MessageCircle className="h-8 w-8 mx-auto mb-2" />
                      <p>No messages yet. Start the conversation!</p>
                    </div>
                  ) : (
                    messages.map((message: Message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.sender_id === currentUser.id ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-[70%] p-3 rounded-lg ${
                            message.sender_id === currentUser.id
                              ? 'bg-primary text-primary-foreground ml-auto'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="text-sm">{message.content}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {formatTime(message.created_at)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Message Input */}
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  disabled={sendMessageMutation.isPending}
                  data-testid="input-message"
                />
                <Button 
                  type="submit" 
                  disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  data-testid="button-send-message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="h-12 w-12 mx-auto mb-4" />
                <p>Select a conversation to start chatting</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}