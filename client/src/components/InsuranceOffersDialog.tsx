import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { INSURANCE_ADVERTS } from "@/lib/insuranceProviders";
import { ShieldCheck, UserPlus } from "lucide-react";
import { Link } from "wouter";

interface InsuranceOffersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "offers" shows the advert links; "needs-profile" prompts profile creation. */
  mode: "offers" | "needs-profile";
}

export function InsuranceOffersDialog({ open, onOpenChange, mode }: InsuranceOffersDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Full-screen scrollable on mobile; constrained, centred on desktop. */}
      <DialogContent className="h-[100dvh] max-h-[100dvh] max-w-none overflow-y-auto rounded-none sm:h-auto sm:max-h-[85vh] sm:max-w-6xl sm:rounded-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Insurance offers for members
          </DialogTitle>
          <DialogDescription>
            {mode === "offers"
              ? "Exclusive discounts on cover for UK-based event freelancers from our insurance partners."
              : "These insurance offers are available to UK-based freelancers with a completed profile."}
          </DialogDescription>
        </DialogHeader>

        {mode === "offers" ? (
          <div className="mt-2">
            {/* Stacked on mobile; side by side on desktop, auto-fitting however
                many adverts exist (two now, three when the next partner lands). */}
            <div className="grid grid-cols-1 gap-4 sm:auto-cols-fr sm:grid-flow-col sm:grid-cols-none">
              {INSURANCE_ADVERTS.map((advert) =>
                advert.url ? (
                  <a
                    key={advert.id}
                    href={advert.url}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    data-testid={`insurance-advert-${advert.id}`}
                    className="block overflow-hidden rounded-xl ring-1 ring-border transition-shadow hover:shadow-lg"
                  >
                    <img src={advert.imageUrl} alt={advert.alt} className="block h-auto w-full" />
                  </a>
                ) : (
                  <div
                    key={advert.id}
                    data-testid={`insurance-advert-${advert.id}`}
                    className="block overflow-hidden rounded-xl ring-1 ring-border"
                  >
                    <img src={advert.imageUrl} alt={advert.alt} className="block h-auto w-full" />
                  </div>
                )
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              EventLink may earn a commission from partners. Offers are provided by third parties;
              always review the policy details before purchasing.
            </p>
          </div>
        ) : (
          <div className="mt-2 flex flex-col items-center gap-4 py-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <UserPlus className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              These offers are for UK-based freelancers. If you&apos;re in the UK, create your
              profile to unlock exclusive insurance discounts from our partners.
            </p>
            <Link href="/dashboard">
              <Button onClick={() => onOpenChange(false)} data-testid="insurance-create-profile">
                Create my profile
              </Button>
            </Link>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
