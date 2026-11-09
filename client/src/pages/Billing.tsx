import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { useLocation } from "wouter";

const FREE_FEATURES = [
  { label: "Create your profile", included: true },
  { label: "Browse & apply for jobs", included: true },
  { label: "Post jobs & search crew", included: true },
  { label: "In-platform messaging", included: true },
  { label: "Basic crew search filters", included: true },
  { label: "Booking management", included: true },
  { label: "Calendar sync (Google & Outlook)", included: true },
  { label: "Digital Business Card & QR Code", included: true },
  { label: "Custom profile URL", included: true },
  { label: "Accounting tools & invoice templates", included: true },
  { label: "ID Verification", included: false },
];

export default function Billing() {
  const [, setLocation] = useLocation();

  return (
    <Layout>
      <div className="container mx-auto max-w-5xl px-4 py-16">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="mb-3 text-4xl font-bold">Simple, transparent pricing</h1>
          <p className="mx-auto max-w-xl text-muted-foreground">
            EventLink is free to use. Upgrade to Pro to unlock your Digital Business Card and tools
            that help you stand out.
          </p>
        </div>

        {/* Cards */}
        <div className="flex justify-center">
          {/* Free */}
          <div className="flex w-full max-w-sm flex-col rounded-2xl border bg-card p-8">
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
              variant="default"
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
