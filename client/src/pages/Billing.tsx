import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useIsPro } from "@/hooks/useIsPro";
import { Check, Loader2, X, Zap } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";


const FREE_FEATURES = [
  { label: "Create your profile", included: true },
  { label: "Browse & apply for jobs", included: true },
  { label: "Post jobs & search crew", included: true },
  { label: "In-platform messaging", included: true },
  { label: "Basic crew search filters", included: true },
  { label: "Booking management", included: true },
  { label: "Portfolio (photos, videos, posts)", included: false },
  { label: "Digital Business Card & QR Code", included: false },
  { label: "Custom profile URL", included: false },
  { label: "Priority in search results", included: false },
  { label: "Profile analytics", included: false },
];

const PRO_FEATURES = [
  { label: "Create your profile", included: true },
  { label: "Browse & apply for jobs", included: true },
  { label: "Post jobs & search crew", included: true },
  { label: "In-platform messaging", included: true },
  { label: "Basic crew search filters", included: true },
  { label: "Booking management", included: true },
  { label: "Portfolio (photos, videos, posts)", included: true },
  { label: "Digital Business Card & QR Code", included: true },
  { label: "Custom profile URL", included: true },
  { label: "Priority in search results", included: true },
  { label: "Profile analytics", included: true },
];

const ANNUAL_PRICE = 49.99;
const ANNUAL_MONTHLY_EQUIV = (ANNUAL_PRICE / 12).toFixed(2);

export default function Billing() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const isPro = useIsPro();
  const [, setLocation] = useLocation();

  const handleGetPro = async () => {
    if (!user) {
      setLocation("/auth?tab=signup");
      return;
    }
    if (isPro) {
      // Open customer portal to manage subscription
      setLoading(true);
      try {
        const res = await fetch("/api/stripe/portal", {
          method: "POST",
          headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
        });
        const data = await res.json();
        if (data.url) window.location.href = data.url;
      } finally {
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({ period: "annual" }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto max-w-5xl px-4 py-16">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="mb-3 text-4xl font-bold">Simple, transparent pricing</h1>
          <p className="mx-auto max-w-xl text-muted-foreground">
            EventLink is free to use. Upgrade to Pro to unlock your portfolio, Digital Business
            Card, and tools that help you stand out.
          </p>

        </div>

        {/* Cards */}
        <div className="grid gap-8 md:grid-cols-2">
          {/* Free */}
          <div className="flex flex-col rounded-2xl border bg-card p-8">
            <div className="mb-6">
              <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Free
              </p>
              <div className="flex items-end gap-1">
                <span className="text-4xl font-bold">£0</span>
                <span className="mb-1 text-muted-foreground">/ forever</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Everything you need to get started on EventLink.
              </p>
            </div>

            <Button
              variant="outline"
              className="mb-8 w-full"
              onClick={() => setLocation("/auth?tab=signup")}
            >
              Get started free
            </Button>

            <ul className="flex-1 space-y-3">
              {FREE_FEATURES.map((f) => (
                <li key={f.label} className="flex items-start gap-3 text-sm">
                  {f.included ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  ) : (
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />
                  )}
                  <span className={f.included ? "text-foreground" : "text-muted-foreground/60"}>
                    {f.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pro */}
          <div className="relative flex flex-col rounded-2xl border-2 border-purple-500 bg-card p-8 shadow-lg shadow-purple-500/10">
            {/* Popular badge */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-1 text-xs font-semibold text-white shadow">
                <Zap className="mr-1 h-3 w-3 fill-white" />
                Most Popular
              </Badge>
            </div>

            <div className="mb-6">
              <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-purple-500">
                Pro
              </p>
              <div className="flex items-end gap-1">
                <span className="text-4xl font-bold">£{ANNUAL_MONTHLY_EQUIV}</span>
                <span className="mb-1 text-muted-foreground">/ mo</span>
              </div>

              <div className="mt-2 space-y-0.5">
                <p className="text-sm text-muted-foreground">
                  Billed as <strong className="text-foreground">£{ANNUAL_PRICE} / year</strong>
                </p>
              </div>
            </div>

            <Button
              className="mb-8 w-full bg-gradient-to-r from-purple-500 to-pink-500 font-semibold text-white hover:from-purple-600 hover:to-pink-600"
              onClick={handleGetPro}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-2 h-4 w-4 fill-white" />
              )}
              {isPro ? "Manage subscription" : user ? "Upgrade to Pro" : "Get Pro"}
            </Button>

            <ul className="flex-1 space-y-3">
              {PRO_FEATURES.map((f) => (
                <li key={f.label} className="flex items-start gap-3 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  <span className="text-foreground">{f.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer note */}
        <p className="mt-10 text-center text-xs text-muted-foreground">
          All prices are in GBP and include VAT where applicable. Billed annually. You can cancel
          your subscription at any time. Payments are processed securely by{" "}
          <span className="font-medium text-foreground">Stripe</span>.
        </p>
      </div>
    </Layout>
  );
}
