import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { INSURANCE_PROVIDERS } from "@/lib/insuranceProviders";
import { ExternalLink, ShieldCheck } from "lucide-react";

interface InsuranceOffersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InsuranceOffersDialog({ open, onOpenChange }: InsuranceOffersDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Insurance offers for members
          </DialogTitle>
          <DialogDescription>
            Exclusive discounts on cover for UK event freelancers from our insurance partners.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex flex-col gap-3">
          {INSURANCE_PROVIDERS.map((provider) => (
            <a
              key={provider.id}
              href={provider.url}
              target="_blank"
              rel="noopener noreferrer sponsored"
              data-testid={`insurance-offer-${provider.id}`}
              className={`group flex items-start justify-between gap-3 rounded-lg border border-l-4 border-border bg-card p-4 transition-shadow hover:shadow-md ${provider.accentClassName}`}
            >
              <div className="min-w-0">
                <div className="font-semibold text-foreground">{provider.name}</div>
                <p className="mt-0.5 text-sm text-muted-foreground">{provider.tagline}</p>
                <span className="mt-2 inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {provider.discount}
                </span>
              </div>
              <ExternalLink className="mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
            </a>
          ))}
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          EventLink may earn a commission from partners. Offers are provided by third parties;
          always review the policy details before purchasing.
        </p>
      </DialogContent>
    </Dialog>
  );
}
