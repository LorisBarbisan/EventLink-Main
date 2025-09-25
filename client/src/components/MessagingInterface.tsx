import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Send, MessageCircle, Clock, User, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface User {
  id: number;
  email: string;
  role: 'freelancer' | 'recruiter';
  deleted_at?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
}

interface Message {
  id: number;
  conversation_id: number;
  sender_id: number | null;
  content: string;
  is_read: boolean;
  is_system_message: boolean;
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

// Helper function to check if a user is deleted
const isUserDeleted = (user: User | undefined): boolean => {
  return user?.deleted_at !== null && user?.deleted_at !== undefined;
};

// Helper function to get display name for user
const getDisplayName = (user: User): string => {
  if (user.role === 'recruiter') {
    return user.company_name || 'Company';
  } else {
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || 'User';
  }
};

// Helper function to get avatar initials
const getAvatarInitials = (user: User): string => {
  if (user.role === 'recruiter') {
    const companyName = user.company_name || 'Company';
    return companyName.substring(0, 2).toUpperCase();
  } else {
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    if (firstName && lastName) {
      return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
    } else if (firstName) {
      return firstName.substring(0, 2).toUpperCase();
    }
    return user.email.substring(0, 2).toUpperCase();
  }
};

interface MessagingInterfaceProps {
  currentUser: User;
}

export function MessagingInterface({ currentUser }: MessagingInterfaceProps) {
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const [deleteMessageId, setDeleteMessageId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch conversations - less frequent polling
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery({
    queryKey: ['/api/conversations', currentUser.id],
    queryFn: () => apiRequest(`/api/conversations`),
    refetchInterval: 60000, // Reduced from 30s to 60s
    refetchIntervalInBackground: false, // Stop when tab is inactive
  });

  // Fetch messages for selected conversation - no polling, rely on WebSocket
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['/api/conversations', selectedConversation, 'messages'],
    queryFn: async () => {
      if (!selectedConversation) return Promise.resolve([]);
      
      const result = await apiRequest(`/api/conversations/${selectedConversation}/messages`);
      
      // Invalidate unread count after messages are fetched (and marked as read on backend)
      queryClient.invalidateQueries({ queryKey: ['/api/messages/unread-count', currentUser.id] });
      
      return result;
    },
    enabled: !!selectedConversation,
    refetchInterval: false, // No polling - rely on WebSocket updates
  });

  // Fetch unread message count - reduced frequency
  const { data: unreadCount = { count: 0 } } = useQuery({
    queryKey: ['/api/messages/unread-count', currentUser.id],
    queryFn: () => apiRequest(`/api/messages/unread-count`),
    refetchInterval: 25000, // Reduced from 10s to 25s
    refetchIntervalInBackground: false, // Stop when tab is inactive
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

  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: number) => {
      return apiRequest(`/api/messages/${messageId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      setDeleteMessageId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/conversations', selectedConversation, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations', currentUser.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages/unread-count', currentUser.id] });
      toast({
        title: 'Success',
        description: 'Message deleted successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete message. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // WebSocket setup
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    const handleOpen = () => {
      console.log('WebSocket connected');
      ws.send(JSON.stringify({ type: 'authenticate', userId: currentUser.id }));
      setWebsocket(ws);
    };

    const handleMessage = (event: MessageEvent) => {
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

    const handleClose = () => {
      console.log('WebSocket disconnected');
      setWebsocket(null);
    };

    const handleError = (error: Event) => {
      console.error('WebSocket error:', error);
    };

    ws.addEventListener('open', handleOpen);
    ws.addEventListener('message', handleMessage);
    ws.addEventListener('close', handleClose);
    ws.addEventListener('error', handleError);

    return () => {
      // Clean up event listeners before closing
      ws.removeEventListener('open', handleOpen);
      ws.removeEventListener('message', handleMessage);
      ws.removeEventListener('close', handleClose);
      ws.removeEventListener('error', handleError);
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
                          {getAvatarInitials(conversation.otherUser)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">
                            {getDisplayName(conversation.otherUser)}
                          </p>
                          {isUserDeleted(conversation.otherUser) && (
                            <Badge variant="secondary" className="text-xs px-2 py-0 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                              Account Deleted
                            </Badge>
                          )}
                        </div>
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
                <span>{conversations.find((c: Conversation) => c.id === selectedConversation)?.otherUser.email || 'Chat'}</span>
                {isUserDeleted(conversations.find((c: Conversation) => c.id === selectedConversation)?.otherUser) && (
                  <Badge variant="secondary" className="ml-2 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                    Account Deleted
                  </Badge>
                )}
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
                        className={`flex group ${
                          message.is_system_message 
                            ? 'justify-center' 
                            : message.sender_id === currentUser.id 
                              ? 'justify-end' 
                              : 'justify-start'
                        }`}
                      >
                        <div
                          className={`${
                            message.is_system_message
                              ? 'max-w-[80%] p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-center'
                              : `max-w-[70%] p-3 rounded-lg relative ${
                                  message.sender_id === currentUser.id
                                    ? 'bg-primary text-primary-foreground ml-auto'
                                    : 'bg-muted'
                                }`
                          }`}
                        >
                          <p className={`text-sm ${message.is_system_message ? 'text-yellow-800 dark:text-yellow-200 italic' : ''}`}>
                            {message.content}
                          </p>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-xs opacity-70">
                              {formatTime(message.created_at)}
                            </p>
                            {/* Delete button for user's own messages (not system messages) */}
                            {!message.is_system_message && message.sender_id === currentUser.id && (
                              <AlertDialog 
                                open={deleteMessageId === message.id} 
                                onOpenChange={(open) => !open && setDeleteMessageId(null)}
                              >
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteMessageId(message.id)}
                                    disabled={deleteMessageMutation.isPending}
                                    data-testid={`button-delete-message-${message.id}`}
                                    className={`h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity ${
                                      message.sender_id === currentUser.id
                                        ? 'hover:bg-primary-foreground/20 text-primary-foreground/70 hover:text-primary-foreground'
                                        : 'hover:bg-muted-foreground/20'
                                    }`}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Message</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete this message? This action cannot be undone and the message will be removed from your view.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel disabled={deleteMessageMutation.isPending}>
                                      Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => deleteMessageMutation.mutate(message.id)}
                                      disabled={deleteMessageMutation.isPending}
                                      data-testid={`button-confirm-delete-message-${message.id}`}
                                      className="bg-red-600 hover:bg-red-700 text-white"
                                    >
                                      {deleteMessageMutation.isPending ? 'Deleting...' : 'Yes, Delete Message'}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Message Input */}
              {(() => {
                const currentConversation = conversations.find((c: Conversation) => c.id === selectedConversation);
                const otherUserDeleted = isUserDeleted(currentConversation?.otherUser);
                
                if (otherUserDeleted) {
                  return (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-center">
                      <p className="text-sm text-red-800 dark:text-red-200">
                        This account has been deleted. You can no longer send messages to this user.
                      </p>
                    </div>
                  );
                }
                
                return (
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
                );
              })()}
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