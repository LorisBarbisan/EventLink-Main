import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";
import {
  BarChart3,
  Briefcase,
  Calendar,
  Check,
  FileText,
  Loader2,
  Receipt,
  Scale,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

const FREE_FEATURES = [
  { label: "Post jobs & search crew", included: true },
  { label: "Job applications management", included: true },
  { label: "In-platform messaging", included: true },
  { label: "Basic crew search filters", included: true },
  { label: "Company profile", included: true },
  { label: "Crew booking calendar", included: false },
  { label: "Availability enquiries", included: false },
  { label: "Booking management & IR35 tracking", included: false },
  { label: "Invoicing & quoting tools", included: false },
  { label: "Team management & delegate access", included: false },
  { label: "Export & reporting tools", included: false },
];

const PRO_FEATURES = [
  { label: "Post jobs & search crew", included: true },
  { label: "Job applications management", included: true },
  { label: "In-platform messaging", included: true },
  { label: "Basic crew search filters", included: true },
  { label: "Company profile", included: true },
  { label: "Crew booking calendar", included: true },
  { label: "Availability enquiries", included: true },
  { label: "Booking management & IR35 tracking", included: true },
  { label: "Invoicing & quoting tools", included: true },
  { label: "Team management & delegate access", included: true },
  { label: "Export & reporting tools", included: true },
];

const ANNUAL_PRICE = 299;
const ANNUAL_MONTHLY_EQUIV = (ANNUAL_PRICE / 12).toFixed(2);

const FMS_ICONS = [
  { icon: Calendar, label: "Booking Calendar" },
  { icon: Users, label: "Crew Management" },
  { icon: Scale, label: "IR35 Tools" },
  { icon: Receipt, label: "Invoicing" },
  { icon: BarChart3, label: "Reporting" },
  { icon: Briefcase, label: "Availability" },
];

export default function FmsPricing() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const handleSubscribe = async () => {
    if (!user) {
      setLocation("/auth?tab=signup");
      return;
    }

    setLoading(true);
    try {
      // In dev/test (no Stripe configured), use the bypass endpoint
      const res = await fetch("/api/subscription/activate-dev", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({ tier: "pro" }),
      });

      if (res.ok) {
        // Invalidate subscription status so the dashboard re-checks
        queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
        setLocation("/dashboard");
        return;
      }

      // Fall through to Stripe checkout for production
      const stripeRes = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({ tier: "pro" }),
      });
      const data = await stripeRes.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto max-w-5xl px-4 py-16">
        {/* Header */}
        <div className="mb-4 text-center">
          <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/10">
            Freelancer Management System
          </Badge>
          <h1 className="mb-3 text-4xl font-bold">Upgrade your hiring workflow</h1>
          <p className="mx-auto max-w-xl text-muted-foreground">
            EventLink FMS gives you a complete back-office for managing your crew — from bookings
            and calendars to IR35 compliance and invoicing.
          </p>
        </div>

        {/* Feature icons */}
        <div className="mb-12 flex flex-wrap justify-center gap-6">
          {FMS_ICONS.map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-1.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>

        {/* Plan cards */}
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
                Everything you need to post jobs and find crew on EventLink.
              </p>
            </div>

            <Button variant="outline" className="mb-8 w-full" disabled>
              Your current plan
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
          <div className="relative flex flex-col rounded-2xl border-2 border-primary bg-card p-8 shadow-lg shadow-primary/10">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <Badge className="bg-primary px-4 py-1 text-xs font-semibold text-white shadow">
                <Zap className="mr-1 h-3 w-3 fill-white" />
                Recommended
              </Badge>
            </div>

            <div className="mb-6">
              <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary">
                FMS Pro
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
              className="mb-8 w-full bg-primary font-semibold text-white hover:bg-primary/90"
              onClick={handleSubscribe}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-2 h-4 w-4 fill-white" />
              )}
              {user ? "Subscribe to FMS" : "Get started"}
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

        {/* Footer */}
        <p className="mt-10 text-center text-xs text-muted-foreground">
          All prices are in GBP. Billed annually. Cancel anytime.{" "}
          <FileText className="mb-0.5 inline h-3 w-3" /> Payments processed securely by{" "}
          <span className="font-medium text-foreground">Stripe</span>.
        </p>
      </div>
    </Layout>
  );
}
