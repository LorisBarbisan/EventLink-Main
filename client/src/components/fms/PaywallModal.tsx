import { Lock, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PaywallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName: string;
}

const HIGHLIGHTS = [
  "Availability enquiry system — replace WhatsApp round-robins",
  "Brief templates — send job briefs and track acknowledgements",
  "Booking calendar, calendar sync, and Excel export",
];

export function PaywallModal({ open, onOpenChange, featureName }: PaywallModalProps) {
  const [, setLocation] = useLocation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 text-amber-600" />
            </div>
            <DialogTitle className="text-lg leading-snug">
              Unlock {featureName}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <p className="text-sm text-muted-foreground">
            This feature is part of EventLink FMS, available to Pro and Teams subscribers.
          </p>

          <ul className="space-y-2">
            {HIGHLIGHTS.map((h) => (
              <li key={h} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                <span>{h}</span>
              </li>
            ))}
          </ul>

          <p className="text-xs text-muted-foreground italic">
            14-day free trial. No commitment. Cancel anytime.
          </p>
        </div>

        <div className="flex gap-3 mt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Maybe later
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              setLocation("/pricing");
            }}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
          >
            Start Free Trial
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
