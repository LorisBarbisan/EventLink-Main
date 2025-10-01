import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Send, MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  freelancer: {
    id: number;
    user_id: number;
    first_name: string;
    last_name: string;
    title: string;
    photo_url?: string;
  };
  currentUser: {
    id: number;
    email: string;
    role: string;
  };
}

export function ContactModal({ isOpen, onClose, freelancer, currentUser }: ContactModalProps) {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { userTwoId: number; content: string }) => {
      // Create conversation and send initial message in one request
      return apiRequest('/api/conversations', {
        method: 'POST',
        body: JSON.stringify({
          userTwoId: data.userTwoId,
          initialMessage: data.content,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Message sent successfully!",
        description: `Your message has been sent to ${freelancer.first_name}.`,
      });
      
      // Clear form and close modal
      setMessage("");
      onClose();
      
      // Invalidate conversations and unread count
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages/unread-count'] });
    },
    onError: (error) => {
      console.error('Error sending message:', error);
      toast({
        title: "Error sending message",
        description: "Please try again later.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsLoading(false);
    },
  });

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) {
      toast({
        title: "Message cannot be empty",
        description: "Please enter a message before sending.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    sendMessageMutation.mutate({
      userTwoId: freelancer.user_id,
      content: message.trim(),
    });
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <MessageCircle className="h-5 w-5 text-blue-600" />
            Contact {freelancer.first_name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Freelancer Info */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <Avatar className="h-12 w-12">
              <AvatarImage src={freelancer.photo_url} alt={freelancer.first_name} />
              <AvatarFallback className="bg-blue-600 text-white">
                {getInitials(freelancer.first_name, freelancer.last_name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-semibold">
                {freelancer.first_name} {freelancer.last_name}
              </div>
              <div className="text-sm text-muted-foreground">
                {freelancer.title}
              </div>
            </div>
          </div>

          {/* Message Form */}
          <form onSubmit={handleSendMessage} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="message">Message *</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message here..."
                rows={6}
                required
                data-testid="textarea-message"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !message.trim()}
                data-testid="button-send-message"
              >
                {isLoading ? (
                  "Sending..."
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Message
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}