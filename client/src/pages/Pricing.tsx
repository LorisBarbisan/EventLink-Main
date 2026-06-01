import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const PRO_FEATURES = [
  "Availability enquiry system",
  "Brief templates and delivery",
  "Booking calendar",
  "Google Calendar and Outlook sync",
  "Excel and CSV export",
  "IR35 guidance (coming soon)",
];

const TEAMS_FEATURES = [
  "Everything in Pro",
  "Up to 10 team members",
  "Shared crew pool",
  "Team availability calendar",
];

const FAQ = [
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel before your trial ends and you won't be charged.",
  },
  {
    q: "What payment methods do you accept?",
    a: "All major credit and debit cards via Stripe.",
  },
  {
    q: "What happens after the free trial?",
    a: "Your card is charged automatically at the end of 14 days.",
  },
  {
    q: "Is my team's data secure?",
    a: "Yes. EventLink uses bank-grade encryption via Stripe.",
  },
  {
    q: "Do freelancers need to subscribe?",
    a: "No. Freelancers always use EventLink for free.",
  },
];

export default function Pricing() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const checkoutMutation = useMutation({
    mutationFn: (tier: "pro" | "teams") =>
      apiRequest("/api/subscription/checkout", {
        method: "POST",
        body: JSON.stringify({ tier }),
      }),
    onSuccess: (data: any) => {
      if (data?.url) window.location.href = data.url;
    },
    onError: () =>
      toast({ title: "Could not start checkout", variant: "destructive" }),
  });

  const handleCta = (tier: "pro" | "teams") => {
    if (!user) {
      setLocation("/auth?redirect=/pricing");
      return;
    }
    checkoutMutation.mutate(tier);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => setLocation("/")}
            className="text-xl font-bold text-[#1E3A5F]"
          >
            EventLink
          </button>
          <div className="flex items-center gap-3">
            {user ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/dashboard")}
              >
                Dashboard
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/auth")}
              >
                Sign In
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-14">
          <h1 className="text-4xl font-bold text-[#1E3A5F] mb-4">
            Unlock the EventLink FMS
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            The complete crew management system for UK event professionals.
          </p>
          <p className="text-sm text-orange-600 font-medium mt-3">
            14-day free trial — no commitment, cancel anytime.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {/* Pro Card */}
          <div className="bg-white rounded-2xl border-2 border-orange-500 shadow-sm p-8 flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-[#1E3A5F]">Pro</h2>
                <p className="text-sm text-muted-foreground mt-1">Up to 3 users · 14-day free trial</p>
              </div>
              <Badge className="bg-orange-100 text-orange-700 border-0 shrink-0">Most Popular</Badge>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold">£49</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-orange-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              size="lg"
              className="w-full bg-orange-500 hover:bg-orange-600 text-white gap-2"
              onClick={() => handleCta("pro")}
              disabled={checkoutMutation.isPending}
            >
              {checkoutMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Start Free Trial
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>

          {/* Teams Card */}
          <div className="bg-white rounded-2xl border border-[#1E3A5F] shadow-sm p-8 flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-[#1E3A5F]">Teams</h2>
                <p className="text-sm text-muted-foreground mt-1">Up to 10 users · 14-day free trial</p>
              </div>
              <Badge className="bg-[#1E3A5F]/10 text-[#1E3A5F] border-0 shrink-0">For growing teams</Badge>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold">£99</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {TEAMS_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-[#1E3A5F] shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              size="lg"
              className="w-full bg-[#1E3A5F] hover:bg-[#16304f] text-white gap-2"
              onClick={() => handleCta("teams")}
              disabled={checkoutMutation.isPending}
            >
              {checkoutMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Start Free Trial
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Sign in nudge */}
        <p className="text-center text-sm text-muted-foreground mb-12">
          Already subscribed?{" "}
          <button
            onClick={() => setLocation("/auth")}
            className="text-orange-600 hover:underline font-medium"
          >
            Sign in to access your dashboard.
          </button>
        </p>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8 text-[#1E3A5F]">
            Frequently Asked Questions
          </h2>
          <Accordion type="single" collapsible className="space-y-2">
            {FAQ.map((item, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="bg-white rounded-lg border px-4"
              >
                <AccordionTrigger className="text-sm font-medium text-left">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </main>
    </div>
  );
}
