import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { Job } from "@shared/types";
import { Check, Share2 } from "lucide-react";
import { useState } from "react";

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

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(jobUrl);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = jobUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
    setCopied(true);
    toast({
      title: "Link copied",
      description: "Job link copied to clipboard",
    });
    fetch(`/api/jobs/${job.id}/link-view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "copy" }),
    }).catch(() => {});
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
          Share
        </>
      )}
    </Button>
  );
}
