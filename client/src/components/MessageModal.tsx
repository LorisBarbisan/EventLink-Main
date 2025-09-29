import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { MessageCircle, Send, Paperclip, X } from 'lucide-react';

interface MessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientId: number;
  recipientName: string;
  senderId: number;
}

export function MessageModal({ isOpen, onClose, recipientId, recipientName, senderId }: MessageModalProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleSendMessage = async () => {
    if (!message.trim() && !attachedFile) {
      toast({
        title: 'Error',
        description: 'Please enter a message or attach a file.',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    try {
      // First, get or create a conversation
      const conversation = await apiRequest('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userOneId: senderId,
          userTwoId: recipientId,
        }),
      });

      // Prepare message data
      const messageData: any = {
        conversation_id: conversation.id,
        sender_id: senderId,
        content: message.trim(),
      };

      // Handle file attachment if present
      if (attachedFile) {
        // Upload file first
        const formData = new FormData();
        formData.append('file', attachedFile);
        
        const uploadResponse = await apiRequest('/api/upload', {
          method: 'POST',
          body: formData,
        });

        messageData.attachment = {
          path: uploadResponse.path,
          name: attachedFile.name,
          type: attachedFile.type,
          size: attachedFile.size,
        };
      }

      // Send the message with optional attachment
      await apiRequest('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData),
      });

      toast({
        title: 'Message sent',
        description: `Your message has been sent to ${recipientName}.`,
      });

      setMessage('');
      setAttachedFile(null);
      setShowFileUploader(false);
      onClose();
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Please select a file smaller than 5MB.',
          variant: 'destructive',
        });
        return;
      }
      
      // Validate file type
      const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.docx'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!allowedTypes.some(type => type.toLowerCase() === fileExtension)) {
        toast({
          title: 'Invalid file type',
          description: 'Please select a PDF, JPG, PNG, or DOCX file.',
          variant: 'destructive',
        });
        return;
      }
      
      setAttachedFile(file);
    }
  };

  const handleRemoveFile = () => {
    setAttachedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAttachFile = () => {
    fileInputRef.current?.click();
  };

  const handleClose = () => {
    setMessage('');
    setAttachedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Send Message to {recipientName}
          </DialogTitle>
          <DialogDescription>
            Send a direct message to this freelancer. They will be notified and can respond through the messaging system.
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
            <p className="text-xs text-muted-foreground mt-1">
              {message.length}/1000 characters
            </p>
          </div>

          {/* File Attachment Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Attachment</Label>
              {!attachedFile && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAttachFile}
                  data-testid="button-attach-file"
                >
                  <Paperclip className="w-4 h-4 mr-2" />
                  Attach File
                </Button>
              )}
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.docx"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              data-testid="file-input"
            />

            {attachedFile && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                <div className="flex items-center space-x-2">
                  <Paperclip className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium">{attachedFile.name}</p>
                    <p className="text-xs text-gray-500">
                      {(attachedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveFile}
                  data-testid="button-remove-attachment"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSending}>
            Cancel
          </Button>
          <Button 
            onClick={handleSendMessage} 
            disabled={isSending || !message.trim()}
            data-testid="button-send-message"
          >
            {isSending ? (
              'Sending...'
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send Message
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}