import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { INSURANCE_PROVIDERS } from "@/lib/insuranceProviders";
import { ExternalLink, ShieldCheck, UserPlus } from "lucide-react";
import { Link } from "wouter";

interface InsuranceOffersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "offers" shows the packages; "needs-profile" prompts profile creation. */
  mode: "offers" | "needs-profile";
}

export function InsuranceOffersDialog({ open, onOpenChange, mode }: InsuranceOffersDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
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
          <>
            <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {INSURANCE_PROVIDERS.map((provider) => (
                <a
                  key={provider.id}
                  href={provider.url}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  data-testid={`insurance-offer-${provider.id}`}
                  className={`group flex flex-col gap-3 rounded-xl border border-t-4 border-border bg-card p-5 transition-shadow hover:shadow-md ${provider.accentClassName}`}
                >
                  {/* Logo / graphic — falls back to initials until real assets are supplied */}
                  <div className="flex items-center gap-3">
                    {provider.logoUrl ? (
                      <img
                        src={provider.logoUrl}
                        alt={`${provider.name} logo`}
                        className="h-10 w-10 rounded-md object-contain"
                      />
                    ) : (
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-muted text-sm font-bold text-muted-foreground">
                        {provider.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="flex-1 text-base font-semibold text-foreground">
                      {provider.name}
                    </span>
                    <ExternalLink className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                  </div>

                  <div className="text-sm font-medium text-foreground">{provider.coverType}</div>

                  <div className="text-lg font-bold text-foreground">{provider.priceLine}</div>

                  <span className="inline-block self-start rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {provider.discount}
                  </span>
                </a>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              EventLink may earn a commission from partners. Offers are provided by third parties;
              always review the policy details before purchasing.
            </p>
          </>
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
