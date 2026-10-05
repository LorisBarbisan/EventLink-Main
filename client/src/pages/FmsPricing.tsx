import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, X, Zap } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

const FREE_FEATURES = [
  { label: "Post jobs & search crew", included: true },
  { label: "Manage applications", included: true },
  { label: "In-platform messaging", included: true },
  { label: "Basic crew search filters", included: true },
  { label: "Company profile page", included: true },
  { label: "Booking Calendar", included: false },
  { label: "Availability Enquiries", included: false },
  { label: "IR35 Status Tracking", included: false },
  { label: "Invoicing & Payment Records", included: false },
  { label: "Team Management", included: false },
  { label: "Export Tools", included: false },
];

const FMS_FEATURES = [
  { label: "Post jobs & search crew", included: true },
  { label: "Manage applications", included: true },
  { label: "In-platform messaging", included: true },
  { label: "Basic crew search filters", included: true },
  { label: "Company profile page", included: true },
  { label: "Booking Calendar", included: true },
  { label: "Availability Enquiries", included: true },
  { label: "IR35 Status Tracking", included: true },
  { label: "Invoicing & Payment Records", included: true },
  { label: "Team Management", included: true },
  { label: "Export Tools", included: true },
];

const MONTHLY_PRICE = 24.99;
const ANNUAL_PRICE = 299;
const ANNUAL_MONTHLY_EQUIV = (ANNUAL_PRICE / 12).toFixed(2);

export default function FmsPricing() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: subData } = useQuery<{ subscribed: boolean; tier: string | null }>({
    queryKey: ["/api/subscription/status"],
    enabled: !!user,
  });
  const isSubscribed = subData?.subscribed === true;

  const handleUpgrade = async () => {
    if (!user) {
      setLocation("/auth?tab=login");
      return;
    }
    if (isSubscribed) {
      setLoading(true);
      try {
        const res = await fetch("/api/subscription/portal", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
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
      // Dev bypass: skip Stripe
      const devRes = await fetch("/api/subscription/activate-dev", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
        body: JSON.stringify({ tier: "pro" }),
      });
      if (devRes.ok) {
        await queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
        setLocation("/dashboard");
        return;
      }
      // Production: Stripe checkout
      const res = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
        body: JSON.stringify({ tier: "pro" }),
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
        <div className="mb-12 text-center">
          <h1 className="mb-3 text-4xl font-bold">Simple, transparent pricing</h1>
          <p className="mx-auto max-w-xl text-muted-foreground">
            EventLink is free for employers. Upgrade to FMS to unlock the full back-office toolkit
            for managing your freelance crew.
          </p>
        </div>

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

            <Button variant="outline" className="mb-8 w-full" disabled={!isSubscribed && !!user} onClick={() => !user && setLocation("/auth?tab=signup")}>
              {isSubscribed ? "Your previous plan" : user ? "Current plan" : "Get started free"}
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

          {/* FMS Pro */}
          <div className="relative flex flex-col rounded-2xl border-2 border-sky-500 bg-card p-8 shadow-lg shadow-sky-500/10">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <Badge className="bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-1 text-xs font-semibold text-white shadow">
                <Zap className="mr-1 h-3 w-3 fill-white" />
                Most Popular
              </Badge>
            </div>

            <div className="mb-6">
              <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-sky-500">
                FMS Pro
              </p>
              <div className="flex items-end gap-1">
                <span className="text-4xl font-bold">£{ANNUAL_MONTHLY_EQUIV}</span>
                <span className="mb-1 text-muted-foreground">/ mo</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Billed as <strong className="text-foreground">£{ANNUAL_PRICE} / year</strong>
              </p>
            </div>

            <Button
              className="mb-8 w-full bg-gradient-to-r from-sky-500 to-blue-600 font-semibold text-white hover:from-sky-600 hover:to-blue-700"
              onClick={handleUpgrade}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-2 h-4 w-4 fill-white" />
              )}
              {isSubscribed ? "Manage subscription" : user ? "Upgrade to FMS" : "Get FMS"}
            </Button>

            <ul className="flex-1 space-y-3">
              {FMS_FEATURES.map((f) => (
                <li key={f.label} className="flex items-start gap-3 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  <span className="text-foreground">{f.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          All prices are in GBP and include VAT where applicable. Billed annually. You can cancel
          at any time. Payments are processed securely by{" "}
          <span className="font-medium text-foreground">Stripe</span>.
        </p>
      </div>
    </Layout>
  );
}
