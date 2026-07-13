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
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background p-4 shadow-lg"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center">
        <p className="flex-1 text-sm text-muted-foreground">
          We use optional cookies for analytics and advertising to understand how EventLink is used
          and to improve it. Essential cookies that keep you signed in are always on. See our{" "}
          <Link href="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>{" "}
          for details.
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => decide("rejected")}>
            Reject
          </Button>
          <Button size="sm" onClick={() => decide("accepted")}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
