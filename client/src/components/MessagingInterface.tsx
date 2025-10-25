import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Send, MessageCircle, Clock, User, Trash2, Paperclip, Download, FileText, Image, FileIcon, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { FileUploader } from "./FileUploader";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";

interface User {
  id: number;
  email: string;
  role: 'freelancer' | 'recruiter';
  deleted_at?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
}

interface MessageAttachment {
  id: number;
  object_path: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  scan_status: 'pending' | 'safe' | 'unsafe' | 'error';
  moderation_status: 'pending' | 'approved' | 'rejected' | 'error';
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
  attachments?: MessageAttachment[];
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

// Helper function to get file icon based on file type
const getFileIcon = (fileType: string) => {
  if (fileType.startsWith('image/')) {
    return <Image className="h-4 w-4" />;
  } else if (fileType === 'application/pdf') {
    return <FileText className="h-4 w-4" />;
  } else {
    return <FileIcon className="h-4 w-4" />;
  }
};

// Helper function to format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Helper function to handle file downloads
const handleFileDownload = async (attachment: MessageAttachment) => {
  try {
    const response = await apiRequest(`/api/files/download/${attachment.id}`);
    if (response.downloadUrl) {
      const link = document.createElement('a');
      link.href = response.downloadUrl;
      link.download = attachment.original_filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  } catch (error) {
    console.error('Download failed:', error);
  }
};

export function MessagingInterface() {
  const { user } = useOptimizedAuth();
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [showFileUploader, setShowFileUploader] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{path: string, name: string, size: number, type: string} | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch conversations
  const { data: conversations = [], isLoading: conversationsLoading, refetch: refetchConversations, error: conversationsError } = useQuery<Conversation[]>({
    queryKey: ['/api/conversations'],
    refetchOnMount: 'always', // Always refetch when component mounts to show new conversations
    refetchOnWindowFocus: true, // Refetch when window gains focus to show new messages
    refetchOnReconnect: true, // Refetch when network reconnects
  });
  
  // Function to create conversation with a specific user
  const createConversationWithUser = async (recipientId: number) => {
    try {
      const response = await apiRequest('/api/conversations/create', {
        method: 'POST',
        body: JSON.stringify({ recipientId }),
      });
      
      if (response.id) {
        await refetchConversations();
        setSelectedConversation(response.id);
        // Clear the query param
        const newUrl = window.location.pathname + '?tab=messages';
        window.history.replaceState({}, '', newUrl);
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
      toast({
        title: "Failed to start conversation",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };
  
  // Check for recipientId in URL query params to auto-open conversation
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const recipientId = params.get('recipientId');
    
    if (recipientId && conversations.length > 0) {
      const recipientIdNum = parseInt(recipientId);
      // Find existing conversation with this recipient
      const existingConversation = conversations.find(conv => 
        conv.otherUser.id === recipientIdNum
      );
      
      if (existingConversation) {
        setSelectedConversation(existingConversation.id);
        // Clear the query param
        const newUrl = window.location.pathname + '?tab=messages';
        window.history.replaceState({}, '', newUrl);
      } else {
        // Create a new conversation with this recipient
        createConversationWithUser(recipientIdNum);
      }
    }
  }, [conversations]);

  // Fetch messages for selected conversation
  const { data: messages = [], refetch: refetchMessages, isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: [`/api/conversations/${selectedConversation}/messages`],
    enabled: selectedConversation !== null,
    refetchInterval: 3000, // Poll every 3 seconds to show new messages
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });


  // Create message mutation
  const createMessageMutation = useMutation({
    mutationFn: async (data: { conversation_id: number; content: string; attachment?: {path: string, name: string, size: number, type: string} }) => {
      const result = await apiRequest(`/api/messages`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return result;
    },
    onSuccess: async (serverMessage) => {
      setNewMessage("");
      setPendingAttachment(null);
      
      // Force an immediate refetch to show the new message
      // This ensures the message appears right away and stays in sync with the server
      await queryClient.invalidateQueries({ 
        queryKey: [`/api/conversations/${selectedConversation}/messages`]
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to send message",
        description: "Please try again",
        variant: "destructive",
      });
    }
  });

  // Delete conversation mutation
  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId: number) => {
      return apiRequest(`/api/conversations/${conversationId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: async (_, conversationId) => {
      setSelectedConversation(null);
      await queryClient.cancelQueries({ queryKey: [`/api/conversations/${conversationId}/messages`] });
      // Invalidate queries - this automatically triggers a refetch in React Query v5
      await queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      toast({
        title: "Conversation deleted",
        description: "The conversation has been removed from your view",
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

  // Handle file upload completion
  const handleFileUploadComplete = (filePath: string, fileName: string, fileSize: number, fileType: string) => {
    setPendingAttachment({ path: filePath, name: fileName, size: fileSize, type: fileType });
    setShowFileUploader(false);
    toast({
      title: "File uploaded",
      description: `${fileName} is ready to send`,
    });
  };

  const handleFileUploadError = (error: string) => {
    toast({
      title: "Upload failed",
      description: error,
      variant: "destructive",
    });
  };

  // Handle sending messages
  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !pendingAttachment) || !selectedConversation) return;
    
    const messageData = {
      conversation_id: selectedConversation,
      content: newMessage.trim() || (pendingAttachment ? 'File attachment' : ''),
      ...(pendingAttachment && { attachment: pendingAttachment })
    };
    
    createMessageMutation.mutate(messageData);
    setPendingAttachment(null);
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
                  <p className="text-sm text-muted-foreground">Send your first message to start a conversation!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {conversations.map((conversation: Conversation) => {
                    return (
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
                          <div className="relative">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="bg-gradient-primary text-white">
                                {getAvatarInitials(conversation.otherUser)}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-medium">
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
                          isSystemMessage ? 'justify-center' : isMyMessage ? 'justify-end' : 'justify-start'
                        }`}>
                          <div className={`max-w-[70%] p-3 rounded-lg ${
                            isSystemMessage 
                              ? 'bg-muted text-muted-foreground text-center text-sm' 
                              : isMyMessage
                              ? 'bg-gradient-primary text-white'
                              : 'bg-gray-100 dark:bg-gray-800 text-foreground'
                          }`}>
                            {message.content && <p className="break-words">{message.content}</p>}
                            
                            {/* File Attachments */}
                            {message.attachments && message.attachments.length > 0 && (
                              <div className="mt-2 space-y-2">
                                {message.attachments.map((attachment) => (
                                  <div 
                                    key={attachment.id} 
                                    className={`flex items-center gap-2 p-2 rounded border ${
                                      isSystemMessage 
                                        ? 'bg-background border-border' 
                                        : isMyMessage
                                        ? 'bg-white/10 border-white/20'
                                        : 'bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                                    }`}
                                  >
                                    {getFileIcon(attachment.file_type)}
                                    <div className="flex-1 min-w-0">
                                      <p className={`text-sm font-medium truncate ${
                                        isSystemMessage ? 'text-foreground' : isMyMessage ? 'text-white' : 'text-foreground'
                                      }`}>
                                        {attachment.original_filename}
                                      </p>
                                      <p className={`text-xs ${
                                        isSystemMessage ? 'text-muted-foreground' : isMyMessage ? 'text-white/70' : 'text-muted-foreground'
                                      }`}>
                                        {formatFileSize(attachment.file_size)}
                                        {attachment.scan_status === 'safe' && attachment.moderation_status === 'approved' && (
                                          <span className="ml-1">• Safe</span>
                                        )}
                                        {(attachment.scan_status === 'pending' || attachment.moderation_status === 'pending') && (
                                          <span className="ml-1">• Scanning...</span>
                                        )}
                                        {(attachment.scan_status === 'unsafe' || attachment.moderation_status === 'rejected') && (
                                          <span className="ml-1 text-red-500">• Blocked</span>
                                        )}
                                      </p>
                                    </div>
                                    {attachment.scan_status === 'safe' && attachment.moderation_status === 'approved' && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleFileDownload(attachment)}
                                        className={`h-8 w-8 p-0 ${
                                          isSystemMessage 
                                            ? 'hover:bg-muted' 
                                            : isMyMessage
                                            ? 'hover:bg-white/20 text-white'
                                            : 'hover:bg-gray-300 dark:hover:bg-gray-600'
                                        }`}
                                      >
                                        <Download className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            <div className={`flex items-center gap-1 mt-1 text-xs ${
                              isSystemMessage 
                                ? 'text-muted-foreground justify-center' 
                                : isMyMessage
                                ? 'text-white/70'
                                : 'text-muted-foreground'
                            }`}>
                              <Clock className="h-3 w-3" />
                              {formatDate(message.created_at)}
                            </div>
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
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message..."
                    className="flex-1"
                    data-testid="input-message"
                    disabled={isUserDeleted(conversations.find((c: Conversation) => c.id === selectedConversation)?.otherUser)}
                  />
                  <Button 
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || createMessageMutation.isPending || isUserDeleted(conversations.find((c: Conversation) => c.id === selectedConversation)?.otherUser)}
                    data-testid="button-send"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="icon" data-testid="button-delete-conversation">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this conversation? This action cannot be undone and will permanently remove all messages.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => selectedConversation && deleteConversationMutation.mutate(selectedConversation)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Delete Conversation
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                {isUserDeleted(conversations.find((c: Conversation) => c.id === selectedConversation)?.otherUser) && (
                  <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
                    This user account has been deleted. You can view the conversation but cannot send new messages.
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4" />
                  <p>Select a conversation to start messaging</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}