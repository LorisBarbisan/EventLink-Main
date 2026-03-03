import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Check, Share2 } from "lucide-react";
import { useState } from "react";

interface ShareProfileButtonProps {
  userId: number;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function ShareProfileButton({ userId, variant = "outline", size = "sm", className }: ShareProfileButtonProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const profileUrl = `${window.location.origin}/profile/${userId}`;

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = profileUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
    setCopied(true);
    toast({
      title: "Profile link copied",
      description: "Your profile link has been copied to the clipboard.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant={variant} size={size} className={className} onClick={handleShare}>
      {copied ? (
        <>
          <Check className="h-4 w-4 mr-1 text-green-600" />
          Copied!
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4 mr-1" />
          Share Profile
        </>
      )}
    </Button>
  );
}
