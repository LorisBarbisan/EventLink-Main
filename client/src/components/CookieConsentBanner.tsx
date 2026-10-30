import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { getCookieConsent, setCookieConsent, type ConsentChoice } from "@/lib/cookieConsent";

export function CookieConsentBanner() {
  const [choice, setChoice] = useState<ConsentChoice | null>(() => getCookieConsent());

  if (choice) return null;

  const decide = (value: ConsentChoice) => {
    setCookieConsent(value);
    setChoice(value);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-2 rounded-lg border border-border bg-background p-3 shadow-lg sm:flex-row sm:items-center sm:gap-4">
        <p className="flex-1 text-sm text-muted-foreground">
          We use optional cookies for analytics and ads.{" "}
          <Link href="/privacy" className="underline hover:text-foreground">
            Privacy&nbsp;Policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-11 flex-1 sm:h-9 sm:flex-none"
            onClick={() => decide("rejected")}
          >
            Reject
          </Button>
          <Button
            size="sm"
            className="h-11 flex-1 sm:h-9 sm:flex-none"
            onClick={() => decide("accepted")}
          >
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
