import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import type { Job } from "@shared/types";
import { Check, Copy, Link, Linkedin, Mail, Share2 } from "lucide-react";
import { useState } from "react";
import { SiWhatsapp, SiFacebook } from "react-icons/si";

interface ShareJobButtonProps {
  job: Job;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function ShareJobButton({ job, variant = "outline", size = "sm", className }: ShareJobButtonProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  if (job.status !== "active" && job.status !== "private") {
    return null;
  }

  const jobUrl = `${window.location.origin}/jobs/${job.id}`;
  const shareTitle = `${job.title} - ${job.company}`;
  const shareText = `Check out this opportunity: ${job.title} at ${job.company} in ${job.location}. View & apply on EventLink!`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(jobUrl);
      setCopied(true);
      toast({
        title: "Link copied",
        description: "Job link copied to clipboard",
      });
      trackShare("copy");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = jobUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      toast({
        title: "Link copied",
        description: "Job link copied to clipboard",
      });
      trackShare("copy");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLinkedIn = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(jobUrl)}`;
    window.open(url, "_blank", "noopener,noreferrer,width=600,height=600");
    trackShare("linkedin");
  };

  const handleWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${jobUrl}`)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    trackShare("whatsapp");
  };

  const handleFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(jobUrl)}`;
    window.open(url, "_blank", "noopener,noreferrer,width=600,height=600");
    trackShare("facebook");
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(shareTitle);
    const body = encodeURIComponent(`${shareText}\n\n${jobUrl}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    trackShare("email");
  };

  const trackShare = (source: string) => {
    fetch(`/api/jobs/${job.id}/link-view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source }),
    }).catch(() => {});
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Share2 className="h-4 w-4 mr-1" />
          Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleCopyLink} className="cursor-pointer">
          {copied ? (
            <Check className="h-4 w-4 mr-2 text-green-600" />
          ) : (
            <Copy className="h-4 w-4 mr-2" />
          )}
          {copied ? "Copied!" : "Copy link"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleLinkedIn} className="cursor-pointer">
          <Linkedin className="h-4 w-4 mr-2 text-[#0A66C2]" />
          LinkedIn
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleWhatsApp} className="cursor-pointer">
          <SiWhatsapp className="h-4 w-4 mr-2 text-[#25D366]" />
          WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleFacebook} className="cursor-pointer">
          <SiFacebook className="h-4 w-4 mr-2 text-[#1877F2]" />
          Facebook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleEmail} className="cursor-pointer">
          <Mail className="h-4 w-4 mr-2" />
          Email
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
