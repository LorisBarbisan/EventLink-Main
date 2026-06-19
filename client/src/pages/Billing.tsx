import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Check, X, Zap } from "lucide-react";
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

const MONTHLY_PRICE = 4.99;
const ANNUAL_PRICE = 49.99;
const ANNUAL_MONTHLY_EQUIV = (ANNUAL_PRICE / 12).toFixed(2);
const ANNUAL_SAVING = (MONTHLY_PRICE * 12 - ANNUAL_PRICE).toFixed(2);
const ANNUAL_SAVING_PCT = Math.round(
  ((MONTHLY_PRICE * 12 - ANNUAL_PRICE) / (MONTHLY_PRICE * 12)) * 100
);

export default function Billing() {
  const [annual, setAnnual] = useState(false);
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const handleGetPro = () => {
    if (!user) {
      setLocation("/auth?tab=signup");
    } else {
      // Stripe checkout will be wired here
      setLocation("/dashboard");
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

          {/* Billing toggle */}
          <div className="mt-8 inline-flex items-center gap-3 rounded-full border bg-muted/40 p-1.5">
            <button
              onClick={() => setAnnual(false)}
              className={`rounded-full px-5 py-1.5 text-sm font-medium transition-all ${
                !annual
                  ? "bg-white text-foreground shadow dark:bg-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`flex items-center gap-2 rounded-full px-5 py-1.5 text-sm font-medium transition-all ${
                annual
                  ? "bg-white text-foreground shadow dark:bg-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Annual
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-400">
                Save {ANNUAL_SAVING_PCT}%
              </span>
            </button>
          </div>
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
                {annual ? (
                  <>
                    <span className="text-4xl font-bold">£{ANNUAL_MONTHLY_EQUIV}</span>
                    <span className="mb-1 text-muted-foreground">/ mo</span>
                  </>
                ) : (
                  <>
                    <span className="text-4xl font-bold">£{MONTHLY_PRICE.toFixed(2)}</span>
                    <span className="mb-1 text-muted-foreground">/ mo</span>
                  </>
                )}
              </div>

              {annual ? (
                <div className="mt-2 space-y-0.5">
                  <p className="text-sm text-muted-foreground">
                    Billed as <strong className="text-foreground">£{ANNUAL_PRICE} / year</strong>
                  </p>
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">
                    You save £{ANNUAL_SAVING} — that&apos;s 2 months free
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Billed monthly. Switch to annual and save £{ANNUAL_SAVING}/yr.
                </p>
              )}
            </div>

            <Button
              className="mb-8 w-full bg-gradient-to-r from-purple-500 to-pink-500 font-semibold text-white hover:from-purple-600 hover:to-pink-600"
              onClick={handleGetPro}
            >
              <Zap className="mr-2 h-4 w-4 fill-white" />
              {user ? "Upgrade to Pro" : "Get Pro"}
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
          All prices are in GBP and include VAT where applicable. You can cancel your subscription
          at any time. Payments are processed securely by{" "}
          <span className="font-medium text-foreground">Stripe</span>.
        </p>
      </div>
    </Layout>
  );
}
