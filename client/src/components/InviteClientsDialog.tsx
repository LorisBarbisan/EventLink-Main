import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Copy, Link as LinkIcon, Mail, Share2, Twitter } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const LinkedInIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect width="4" height="12" x="2" y="9" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M16.95 7.05a10 10 0 0 0-14.1 14.1l-2.85 2.85 2.85-2.85a10 10 0 0 0 14.1-14.1z" />
    <path d="M12.42 16.5c1.1-.34 2.13-.9 3.03-1.65l-4-4c-.75.9-1.31 1.93-1.65 3.03-.34 1.1.22 2.05.97 2.62.75.57 2.05-.17 2.62-.97.57-.75.03-1.85-.97-2.62" />
    <path d="M8 8l8 8" />
  </svg>
);

interface InviteClientsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: number;
}

export function InviteClientsDialog({ open, onOpenChange, userId }: InviteClientsDialogProps) {
  const { toast } = useToast();

  const { data: tokenData, isLoading } = useQuery<{ token: string; url: string }>({
    queryKey: ["/api/references/my-token"],
    enabled: open,
  });

  const referenceUrl = tokenData?.url || "";
  const shareText = "I'd appreciate your honest feedback. Please take 45 seconds to complete my reference on EventLink.";

  const handleCopy = async () => {
    if (!referenceUrl) return;
    try {
      await navigator.clipboard.writeText(referenceUrl);
      toast({ title: "Link copied!", description: "Reference link copied to clipboard." });
    } catch {
      toast({ title: "Failed to copy", description: "Could not copy link to clipboard.", variant: "destructive" });
    }
  };

  const shareLinks = {
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referenceUrl)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(shareText + " " + referenceUrl)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(referenceUrl)}`,
    email: `mailto:?subject=${encodeURIComponent("Would you write me a reference on EventLink?")}&body=${encodeURIComponent(shareText + "\n\n" + referenceUrl)}`,
  };

  const openShareLink = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-orange-500" />
            Build My Reputation
          </DialogTitle>
          <DialogDescription>
            Share your personal reference request link with clients you&apos;ve worked with in
            the past to build your reputation.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center space-x-2 my-4">
          <div className="grid flex-1 gap-2">
            <Input
              id="link"
              value={isLoading ? "Generating your link…" : referenceUrl}
              readOnly
              className="bg-muted text-muted-foreground text-sm"
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="px-3"
            onClick={handleCopy}
            disabled={isLoading || !referenceUrl}
          >
            <span className="sr-only">Copy</span>
            <Copy className="h-4 w-4" />
            <span className="ml-2">Copy</span>
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-fit flex items-center justify-center gap-2"
                disabled={isLoading || !referenceUrl}
              >
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={() => openShareLink(shareLinks.linkedin)} className="cursor-pointer">
                <LinkedInIcon className="mr-2 h-4 w-4" />
                <span>LinkedIn</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openShareLink(shareLinks.whatsapp)} className="cursor-pointer">
                <WhatsAppIcon className="mr-2 h-4 w-4" />
                <span>WhatsApp</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openShareLink(shareLinks.twitter)} className="cursor-pointer">
                <Twitter className="mr-2 h-4 w-4" />
                <span>X (Twitter)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openShareLink(shareLinks.email)} className="cursor-pointer">
                <Mail className="mr-2 h-4 w-4" />
                <span>Email</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="text-xs text-muted-foreground mt-2">
            Anyone with your link can submit a reference — no sign-in required. References appear
            on your public profile and contribute to your verified reputation badges.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
