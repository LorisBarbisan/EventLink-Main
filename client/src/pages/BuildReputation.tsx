import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Copy, Link as LinkIcon, Mail, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";

const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect width="4" height="12" x="2" y="9" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

export default function BuildReputation() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      setLocation("/auth");
    }
  }, [user, loading, setLocation]);

  const { data: tokenData, isLoading: tokenLoading } = useQuery<{ token: string; url: string }>({
    queryKey: ["/api/references/my-token"],
    enabled: !!user,
  });

  const referenceUrl = tokenData?.url ?? "";
  const shareText = "I'd appreciate your honest feedback. Please take 45 seconds to complete my reference on EventLink.";

  const handleCopy = async () => {
    if (!referenceUrl) return;
    try {
      await navigator.clipboard.writeText(referenceUrl);
      setCopied(true);
      toast({ title: "Link copied!", description: "Share it with a past client to get a verified reference." });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({ title: "Could not copy", variant: "destructive" });
    }
  };

  const shareLinks = {
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referenceUrl)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(shareText + " " + referenceUrl)}`,
    email: `mailto:?subject=${encodeURIComponent("Would you write me a reference on EventLink?")}&body=${encodeURIComponent(shareText + "\n\n" + referenceUrl)}`,
  };

  if (loading || !user) return null;

  return (
    <Layout>
      <div className="max-w-xl mx-auto px-4 py-12 space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center mx-auto">
            <BadgeCheck className="w-7 h-7 text-orange-600" />
          </div>
          <h1 className="text-2xl font-bold">Build My Reputation</h1>
          <p className="text-muted-foreground text-sm">
            Share your personal reference link with past clients. They answer 3 quick questions
            and your profile gets a verified badge — no account needed on their end.
          </p>
        </div>

        {/* Link card */}
        <Card className="border-2 border-orange-200">
          <CardContent className="pt-5 pb-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <LinkIcon className="w-4 h-4 text-orange-500" />
              Your reference link
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 bg-muted rounded-md px-3 py-2 text-sm text-muted-foreground font-mono truncate select-all">
                {tokenLoading ? "Generating your link…" : referenceUrl}
              </div>
              <Button
                onClick={handleCopy}
                disabled={tokenLoading || !referenceUrl}
                className="shrink-0 bg-orange-600 hover:bg-orange-700"
                size="sm"
              >
                <Copy className="w-4 h-4 mr-1.5" />
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>

            {/* Share row */}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                disabled={!referenceUrl}
                onClick={() => window.open(shareLinks.whatsapp, "_blank", "noopener,noreferrer")}
              >
                <WhatsAppIcon />
                <span className="ml-1.5">WhatsApp</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!referenceUrl}
                onClick={() => window.open(shareLinks.linkedin, "_blank", "noopener,noreferrer")}
              >
                <LinkedInIcon />
                <span className="ml-1.5">LinkedIn</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!referenceUrl}
                onClick={() => window.open(shareLinks.email)}
              >
                <Mail className="w-4 h-4" />
                <span className="ml-1.5">Email</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* How it works */}
        <Card>
          <CardContent className="pt-5 pb-5 space-y-3">
            <p className="text-sm font-medium">How it works</p>
            <ol className="space-y-2 text-sm text-muted-foreground">
              {[
                "Copy your link above",
                "Send it to a past client or employer",
                "They answer 3 quick questions (no account needed)",
                "A verified badge appears on your profile",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="flex gap-3">
          <Link href="/dashboard?tab=references" className="flex-1">
            <Button variant="outline" className="w-full">
              View all my references
            </Button>
          </Link>
          <Link href="/dashboard" className="flex-1">
            <Button variant="outline" className="w-full">
              Back to dashboard
            </Button>
          </Link>
        </div>

      </div>
    </Layout>
  );
}
