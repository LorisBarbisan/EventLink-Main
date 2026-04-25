import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Star,
  User,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

export default function PostApplication() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [showRepSection, setShowRepSection] = useState(false);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: tokenData, isLoading: tokenLoading } = useQuery<{ token: string; url: string }>({
    queryKey: ["/api/references/my-token"],
    enabled: showRepSection,
  });

  const { data: references } = useQuery<any[]>({
    queryKey: ["/api/references/freelancer", user?.id],
    queryFn: () => apiRequest(`/api/references/freelancer/${user?.id}`),
    enabled: !!user,
  });

  const referenceCount = references?.length ?? 0;
  const hasReferences = referenceCount > 0;

  const profileStrength = 80;
  const referenceStrength = Math.min(referenceCount * 33, 100);

  const handleCopy = async () => {
    if (!tokenData?.url) return;
    try {
      await navigator.clipboard.writeText(tokenData.url);
      setCopied(true);
      toast({ title: "Link copied!", description: "Share it with a past client to get a reference." });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({ title: "Could not copy", variant: "destructive" });
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">

        {/* 1. Success State */}
        <div className="flex flex-col items-center text-center gap-3 py-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-green-600" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Application sent</h1>
            <p className="text-muted-foreground mt-1">
              Your application has been submitted successfully.
            </p>
          </div>
        </div>

        {/* 2. Core Conversion Block */}
        {!showRepSection ? (
          <Card className="border-2 border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800 shadow-md">
            <CardContent className="pt-6 pb-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Star className="w-5 h-5 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h2 className="font-semibold text-lg text-foreground leading-snug">
                    Stand out for this role
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add a quick reference from a previous client to strengthen your application.{" "}
                    <span className="text-foreground font-medium">
                      Profiles with references are more likely to be shortlisted.
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <BadgeCheck className="w-3.5 h-3.5 text-green-500" />
                    Takes less than a minute
                  </p>
                </div>
              </div>

              {/* Visual Cue */}
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="rounded-lg border bg-background p-3 text-center space-y-1">
                  <div className="flex justify-center">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">Your profile now</p>
                  <div className="flex items-center justify-center gap-1 text-red-500 text-xs">
                    <XCircle className="w-3.5 h-3.5" />
                    No references
                  </div>
                </div>
                <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 p-3 text-center space-y-1">
                  <div className="flex justify-center">
                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                      <User className="w-4 h-4 text-green-600" />
                    </div>
                  </div>
                  <p className="text-xs text-green-700 dark:text-green-400 font-medium">What employers see</p>
                  <div className="flex items-center justify-center gap-1 text-green-600 text-xs">
                    <BadgeCheck className="w-3.5 h-3.5" />
                    Verified references
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <Button
                  className="bg-orange-600 hover:bg-orange-700 text-white flex-1"
                  onClick={() => setShowRepSection(true)}
                >
                  Build My Reputation
                </Button>
                <Link href="/jobs">
                  <Button variant="ghost" className="text-muted-foreground hover:text-foreground w-full sm:w-auto text-sm">
                    Skip for now
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Reference Link Section — shown after clicking "Build My Reputation" */
          <Card className="border-2 border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 shadow-md">
            <CardContent className="pt-6 pb-5 space-y-4">
              <div className="flex items-center gap-2">
                <BadgeCheck className="w-5 h-5 text-green-600" />
                <h2 className="font-semibold text-lg text-foreground">Your reference link</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Send this link to a past client — they answer 3 quick questions and your profile gets a verified badge.
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-background border rounded-md px-3 py-2 text-sm text-muted-foreground truncate select-all font-mono">
                  {tokenLoading ? "Generating your link…" : (tokenData?.url ?? "")}
                </div>
                <Button
                  size="sm"
                  className="shrink-0 bg-orange-600 hover:bg-orange-700"
                  onClick={handleCopy}
                  disabled={tokenLoading || !tokenData?.url}
                >
                  <Copy className="w-4 h-4 mr-1" />
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
              <Button
                variant="ghost"
                className="text-xs text-muted-foreground px-0 h-auto"
                onClick={() => setShowRepSection(false)}
              >
                ← Back
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 4. Profile Strength */}
        <Card>
          <CardContent className="pt-5 pb-4 space-y-4">
            <h3 className="font-semibold text-sm text-foreground">Your profile strength</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Profile</span>
                  <span>{profileStrength}%</span>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${profileStrength}%` }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>References</span>
                  <span>{hasReferences ? `${referenceCount} added` : "0%"}</span>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full bg-orange-500 transition-all"
                    style={{ width: `${referenceStrength}%` }}
                  />
                </div>
              </div>
            </div>
            {!hasReferences && (
              <p className="text-xs text-muted-foreground">
                Add 2–3 references to stand out to event teams.
              </p>
            )}
          </CardContent>
        </Card>

        {/* 5. How it Works — Expandable */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <button
              onClick={() => setHowItWorksOpen((v) => !v)}
              className="w-full flex items-center justify-between text-sm font-medium text-foreground"
            >
              <span>How it works</span>
              {howItWorksOpen ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
            {howItWorksOpen && (
              <ol className="mt-4 space-y-3 text-sm text-muted-foreground list-none">
                {[
                  "Get your unique reference link",
                  "Send it to a past client",
                  "They answer 3 quick questions",
                  "Your profile gets a verified badge",
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 text-xs font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        {/* 6. Urgency line */}
        <p className="text-xs text-center text-muted-foreground">
          Employers may review applications shortly — make sure your profile stands out.
        </p>

        {/* 7. Footer Options */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link href="/dashboard" className="flex-1">
            <Button variant="outline" className="w-full">
              View application
            </Button>
          </Link>
          <Link href="/jobs" className="flex-1">
            <Button variant="outline" className="w-full">
              Browse more jobs
            </Button>
          </Link>
        </div>

      </div>
    </Layout>
  );
}
