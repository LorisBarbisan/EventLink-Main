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
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";

interface User {
  id: number;
  email: string;
  role: 'freelancer' | 'recruiter' | 'admin';
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

// Helper function to get display name for a user
const getDisplayName = (user: User): string => {
  if (isUserDeleted(user)) {
    return `[Deleted ${user.role === 'freelancer' ? 'Freelancer' : 'Company'}]`;
  }
  
  if (user.first_name && user.last_name) {
    return `${user.first_name} ${user.last_name}`;
  }
  if (user.company_name) {
    return user.company_name;
  }
  return user.email;
};

// Helper function to get avatar initials
const getAvatarInitials = (user: User): string => {
  if (isUserDeleted(user)) {
    return user.role === 'freelancer' ? 'DF' : 'DC';
  }
  
  if (user.first_name && user.last_name) {
    return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
  }
  if (user.company_name) {
    return user.company_name.substring(0, 2).toUpperCase();
  }
  return user.email.substring(0, 2).toUpperCase();
};

// Helper function to format dates
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMinutes < 1) {
    return 'Just now';
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  } else if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
};

export function MessagingInterface() {
  const { user } = useOptimizedAuth();
  
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch messages using React Query (enabled only when a conversation is selected)
  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ['/api/conversations', selectedConversation, 'messages'],
    queryFn: () => apiRequest(`/api/conversations/${selectedConversation}/messages`),
    enabled: selectedConversation !== null,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false, // Don't refetch on focus to preserve optimistic updates
    staleTime: 30000, // Consider data fresh for 30 seconds
  });

  // Fetch conversations (still using React Query)
  const { data: conversations = [], isLoading: conversationsLoading, refetch: refetchConversations } = useQuery<Conversation[]>({
    queryKey: ['/api/conversations'],
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Delete conversation mutation
  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId: number) => {
      return apiRequest(`/api/conversations/${conversationId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: (_, conversationId) => {
      // Immediately update the cache to remove the deleted conversation
      queryClient.setQueryData<Conversation[]>(
        ['/api/conversations'],
        (oldConversations = []) => oldConversations.filter(c => c.id !== conversationId)
      );
      
      setSelectedConversation(null);
      
      toast({
        title: "Conversation deleted",
        description: "The conversation has been permanently removed",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete conversation",
        description: "Please try again",
        variant: "destructive",
      });
    }
  });

  // Send message mutation - simple fetch-first approach
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: { conversation_id: number; content: string }) => {
      console.log('🚀 Sending message:', messageData);
      const result = await apiRequest(`/api/messages`, {
        method: 'POST',
        body: JSON.stringify(messageData),
      });
      console.log('✅ Message sent successfully:', result);
      return result;
    },
    onSuccess: (data, variables) => {
      console.log('✅ onSuccess triggered, data:', data);
      
      // OPTIMISTIC UPDATE: Immediately add message to cache for instant UI update
      queryClient.setQueryData<Message[]>(
        ['/api/conversations', variables.conversation_id, 'messages'], 
        (old = []) => {
          console.log('📝 Adding message to cache optimistically');
          // Check if message already exists (avoid duplicates)
          if (old.some(msg => msg.id === data.id)) {
            console.log('⚠️ Message already in cache, skipping');
            return old;
          }
          
          // Create the full message object with sender info
          const newMessage: Message & { sender: any } = {
            id: data.id,
            conversation_id: data.conversation_id,
            sender_id: data.sender_id,
            content: data.content,
            is_read: data.is_read || false,
            is_system_message: data.is_system_message || false,
            created_at: data.created_at || new Date(),
            sender: {
              id: data.sender_id,
              email: user?.email || '',
              role: user?.role || 'freelancer',
              password: '',
              first_name: null,
              last_name: null,
              email_verified: false,
              email_verification_token: null,
              email_verification_expires: null,
              password_reset_token: null,
              password_reset_expires: null,
              auth_provider: 'email' as const,
              google_id: null,
              facebook_id: null,
              linkedin_id: null,
              profile_photo_url: null,
              last_login_method: null,
              last_login_at: null,
              deleted_at: null,
              created_at: new Date(),
              updated_at: new Date()
            }
          };
          console.log('✅ Message added to cache, new total:', old.length + 1);
          return [...old, newMessage];
        }
      );
      
      // Update conversations list last_message_at without refetching
      queryClient.setQueryData<Conversation[]>(
        ['/api/conversations'],
        (old = []) => {
          return old.map(conv => 
            conv.id === variables.conversation_id
              ? { ...conv, last_message_at: new Date().toISOString() }
              : conv
          );
        }
      );
      
      // DO NOT refetch - it overwrites the optimistic update before DB is ready
      // WebSocket will handle updates for the recipient
    },
    onError: (error, variables) => {
      console.error('❌ Message send failed:', error);
      // Only restore user input if fields are still empty
      // (prevents overwriting new content user typed while mutation was in flight)
      setNewMessage(prev => prev === "" ? variables.content : prev);
      
      toast({
        title: "Failed to send message",
        description: "Please try again",
        variant: "destructive",
      });
    }
  });

  // Handle sending messages
  const handleSendMessage = () => {
    console.log('📝 handleSendMessage called');
    console.log('newMessage:', newMessage);
    console.log('selectedConversation:', selectedConversation);
    
    if (!newMessage.trim() || !selectedConversation) {
      console.log('⚠️ Send blocked - missing message or conversation');
      return;
    }
    
    const messageData = {
      conversation_id: selectedConversation,
      content: newMessage.trim()
    };
    
    console.log('📤 Preparing to send:', messageData);
    
    // Clear inputs immediately BEFORE mutation to prevent race condition
    // if user switches conversations while mutation is in flight
    setNewMessage("");
    
    sendMessageMutation.mutate(messageData);
  };

  // Handle key press in input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Handle conversation selection from URL parameters (from notifications)
  useEffect(() => {
    if (!conversations.length) return; // Wait until conversations are loaded
    
    const urlParams = new URLSearchParams(window.location.search);
    const conversationParam = urlParams.get('conversation');
    
    if (conversationParam) {
      const conversationId = parseInt(conversationParam);
      
      // Check if this conversation exists in the user's conversations
      const conversationExists = conversations.some(c => c.id === conversationId);
      
      if (conversationExists && conversationId !== selectedConversation) {
        console.log('📬 Auto-selecting conversation from notification:', conversationId);
        setSelectedConversation(conversationId);
      }
      
      // Clear the conversation parameter from URL after handling
      urlParams.delete('conversation');
      const newUrl = urlParams.toString() 
        ? `${window.location.pathname}?${urlParams.toString()}` 
        : window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [conversations]); // Only run when conversations change

  // WebSocket connection for real-time message updates
  useEffect(() => {
    if (!user?.id) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'authenticate', userId: user.id }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle NEW_MESSAGE events for recipient
        if (data.type === 'NEW_MESSAGE') {
          console.log('📨 WebSocket: New message received', data);
          
          // IMMEDIATE refetch for active conversation (recipient sees message instantly)
          if (data.conversation_id === selectedConversation) {
            console.log('🔄 Refetching messages for active conversation:', selectedConversation);
            queryClient.refetchQueries({ 
              queryKey: ['/api/conversations', selectedConversation, 'messages'],
              type: 'active' 
            });
          }
          
          // Always refresh conversations list
          queryClient.refetchQueries({ queryKey: ['/api/conversations'] });
        }
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('Messaging WebSocket error:', error);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [selectedConversation, user?.id, queryClient]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5" />
        <h1 className="text-2xl font-bold">Messages</h1>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversations List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Conversations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              {conversationsLoading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No conversations yet</p>
                  <p className="text-sm text-muted-foreground">Start messaging by visiting a profile</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {conversations.map((conversation: Conversation) => {
                    const isDeleted = isUserDeleted(conversation.otherUser);
                    return (
                      <div
                        key={conversation.id}
                        data-testid={`conversation-${conversation.id}`}
                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedConversation === conversation.id
                            ? 'bg-primary/10 border-primary'
                            : 'hover:bg-muted'
                        } ${isDeleted ? 'opacity-60' : ''}`}
                        onClick={() => setSelectedConversation(conversation.id)}
                      >
                        <Avatar className={isDeleted ? 'opacity-50' : ''}>
                          <AvatarFallback className={isDeleted ? 'bg-red-100 text-red-600' : ''}>
                            {getAvatarInitials(conversation.otherUser)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`font-medium truncate ${isDeleted ? 'text-muted-foreground' : ''}`}>
                              {getDisplayName(conversation.otherUser)}
                            </p>
                            {isDeleted && (
                              <Badge variant="secondary" className="text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                Deleted
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">
                              {formatDate(conversation.last_message_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
                <ScrollArea className="flex-1 mb-4 pr-4">
                  <div className="space-y-4">
                    {messagesLoading ? (
                      <div className="flex items-center justify-center p-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-8 text-center">
                        <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">No messages yet</p>
                        <p className="text-sm text-muted-foreground">Start the conversation!</p>
                      </div>
                    ) : (
                      messages.map((message) => {
                        const isMyMessage = message.sender_id === user?.id;
                        const isSystemMessage = message.sender_id === null;
                        
                        return (
                        <div key={message.id} className={`flex ${
                          isSystemMessage ? 'justify-center' : isMyMessage ? 'justify-start' : 'justify-end'
                        }`}>
                          <div className={`max-w-[70%] p-3 rounded-lg ${
                            isSystemMessage 
                              ? 'bg-muted text-muted-foreground text-center text-sm' 
                              : isMyMessage
                              ? 'bg-gray-100 dark:bg-gray-800 text-foreground'
                              : 'bg-gradient-primary text-white'
                          }`}>
                            <p className="break-words">{message.content}</p>
                            
                            <p className={`text-xs mt-1 ${
                              isSystemMessage ? 'text-muted-foreground' : isMyMessage ? 'text-muted-foreground' : 'text-white/70'
                            }`}>
                              {formatDate(message.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Message Input */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={!selectedConversation}
                    data-testid="input-message"
                  />
                  <Button 
                    onClick={handleSendMessage} 
                    disabled={!newMessage.trim() || !selectedConversation}
                    data-testid="button-send-message"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send
                  </Button>
                </div>

                {/* Delete Conversation */}
                <div className="mt-4 pt-4 border-t">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        data-testid="button-delete-conversation"
                      >
                        <Trash2 className="h-3 w-3 mr-2" />
                        Delete Conversation
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete this conversation and all messages. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteConversationMutation.mutate(selectedConversation)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          data-testid="button-confirm-delete"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageCircle className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-muted-foreground">Select a conversation</p>
                <p className="text-sm text-muted-foreground">Choose a conversation from the list to start messaging</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
