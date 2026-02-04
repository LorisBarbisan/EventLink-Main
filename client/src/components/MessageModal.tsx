import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { usePersistentState } from "@/hooks/usePersistentState";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Send } from "lucide-react";
import { useState } from "react";

interface MessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientId: number;
  recipientName: string;
}

export function MessageModal({ isOpen, onClose, recipientId, recipientName }: MessageModalProps) {
  const draftKey = `message_modal_draft_${recipientId}`;
  const [message, setMessage, clearMessage, isDirty] = usePersistentState(draftKey, "");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSendMessage = async () => {
    if (!message.trim()) {
      toast({
        title: "Error",
        description: "Please enter a message.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      // Create conversation and send initial message
      const response = await apiRequest("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userTwoId: recipientId,
          initialMessage: message.trim(),
        }),
      });

      toast({
        title: "Message sent",
        description: `Your message has been sent to ${recipientName}.`,
      });

      // Invalidate conversations cache to refresh the messages list
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${response.id}/messages`] });

      clearMessage();
      // Wait a tick to ensure state update before closing
      setTimeout(() => onClose(), 0);
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Send Message to {recipientName}
          </DialogTitle>
          <DialogDescription>
            Send a direct message to this freelancer. They will be notified and can respond through
            the messaging system.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="message-content">Message</Label>
            <Textarea
              id="message-content"
              placeholder="Type your message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="resize-none"
              data-testid="textarea-message-content"
            />
            <p className="mt-1 text-xs text-muted-foreground">{message.length}/1000 characters</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isSending}>
            Cancel
          </Button>
          <Button
            onClick={handleSendMessage}
            disabled={isSending || !message.trim()}
            data-testid="button-send-message"
          >
            {isSending ? (
              "Sending..."
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Message
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
