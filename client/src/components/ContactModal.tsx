import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { usePersistentState } from "@/hooks/usePersistentState";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Send } from "lucide-react";
import { useState } from "react";

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

export function ContactModal({ isOpen, onClose, freelancer }: ContactModalProps) {
  const draftKey = `contact_draft_${freelancer.user_id}`;
  const [message, setMessage, clearMessage, isDirty] = usePersistentState(draftKey, "");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { userTwoId: number; content: string }) => {
      // Create conversation and send initial message in one request
      return apiRequest("/api/conversations", {
        method: "POST",
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
      clearMessage();
      // Wait a tick to ensure state update before closing
      setTimeout(() => onClose(), 0);

      // Refetch conversations immediately (including inactive queries)
      queryClient.refetchQueries({ queryKey: ["/api/conversations"], type: "all" });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/unread-count"] });
    },
    onError: (error) => {
      console.error("Error sending message:", error);
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

  const handleCancel = () => {
    if (isDirty) {
      setShowConfirmDialog(true);
    } else {
      onClose();
    }
  };

  const handleConfirmClose = () => {
    clearMessage();
    setShowConfirmDialog(false);
    onClose();
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ConfirmDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        title="Unsaved Changes"
        description="You have unsaved changes in your message. Are you sure you want to discard them?"
        onConfirm={handleConfirmClose}
        onCancel={() => setShowConfirmDialog(false)}
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <MessageCircle className="h-5 w-5 text-blue-600" />
            Contact {freelancer.first_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Freelancer Info */}
          <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
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
              <div className="text-sm text-muted-foreground">{freelancer.title}</div>
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
                onClick={handleCancel}
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
                    <Send className="mr-2 h-4 w-4" />
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
