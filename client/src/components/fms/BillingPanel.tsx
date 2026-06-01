import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, AlertTriangle, XCircle, CreditCard, Loader2 } from "lucide-react";

interface SubStatus {
  subscribed: boolean;
  tier: "pro" | "teams" | null;
  status: "trialing" | "active" | "past_due" | "canceled" | "incomplete" | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function tierLabel(tier: string | null): string {
  if (tier === "teams") return "Teams";
  return "Pro";
}

function tierPrice(tier: string | null): string {
  return tier === "teams" ? "£99" : "£49";
}

export function BillingPanel() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: sub, isLoading } = useQuery<SubStatus>({
    queryKey: ["/api/subscription/status"],
    queryFn: () => apiRequest("/api/subscription/status"),
  });

  const portalMutation = useMutation({
    mutationFn: () => apiRequest("/api/subscription/portal", { method: "POST" }),
    onSuccess: (data: any) => {
      if (data?.url) window.location.href = data.url;
    },
    onError: () => toast({ title: "Could not open billing portal", variant: "destructive" }),
  });

  // Handle ?subscribed=true redirect from Stripe Checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("subscribed") === "true") {
      toast({
        title: `Welcome to EventLink ${sub?.tier === "teams" ? "Teams" : "Pro"}!`,
        description: "Your 14-day free trial has started.",
      });
      const url = new URL(window.location.href);
      url.searchParams.delete("subscribed");
      window.history.replaceState({}, "", url.toString());
    }
  }, [sub]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-9 w-40" />
        </CardContent>
      </Card>
    );
  }

  // NOT SUBSCRIBED
  if (!sub || !sub.subscribed && sub.status !== "past_due" && sub.status !== "canceled") {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-4">
          <CreditCard className="mx-auto h-12 w-12 text-muted-foreground" />
          <div>
            <p className="font-semibold text-lg">You're not currently subscribed to EventLink FMS</p>
            <p className="text-sm text-muted-foreground mt-1">
              Start your 14-day free trial to unlock all crew management features.
            </p>
          </div>
          <Button
            onClick={() => setLocation("/pricing")}
            className="bg-orange-500 hover:bg-orange-600"
          >
            Start Free Trial
          </Button>
        </CardContent>
      </Card>
    );
  }

  // TRIALING
  if (sub.status === "trialing") {
    return (
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <Badge className="bg-green-100 text-green-700 border-0">Free Trial Active</Badge>
          </div>
          <div>
            <p className="font-semibold">
              Your {tierLabel(sub.tier)} trial ends on {formatDate(sub.trialEndsAt)}.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              After this date your card will be charged {tierPrice(sub.tier)} per month.
            </p>
          </div>
          <Button
            onClick={() => portalMutation.mutate()}
            disabled={portalMutation.isPending}
            variant="outline"
          >
            {portalMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Manage Subscription
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ACTIVE
  if (sub.status === "active") {
    return (
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <Badge className="bg-green-100 text-green-700 border-0">
              {tierLabel(sub.tier)} — Active
            </Badge>
            {sub.cancelAtPeriodEnd && (
              <Badge className="bg-amber-100 text-amber-700 border-0">
                Cancels on {formatDate(sub.currentPeriodEnd)}
              </Badge>
            )}
          </div>
          {sub.cancelAtPeriodEnd ? (
            <p className="text-sm text-muted-foreground">
              Your subscription will not renew. You have access until{" "}
              {formatDate(sub.currentPeriodEnd)}.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Next billing date: {formatDate(sub.currentPeriodEnd)}
            </p>
          )}
          <Button
            onClick={() => portalMutation.mutate()}
            disabled={portalMutation.isPending}
            variant="outline"
          >
            {portalMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Manage Subscription
          </Button>
        </CardContent>
      </Card>
    );
  }

  // PAST DUE
  if (sub.status === "past_due") {
    return (
      <Card className="border-red-200">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <Badge className="bg-red-100 text-red-700 border-0">Payment Failed</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Your last payment failed. Please update your payment method to maintain access.
          </p>
          <Button
            onClick={() => portalMutation.mutate()}
            disabled={portalMutation.isPending}
            className="bg-red-600 hover:bg-red-700"
          >
            {portalMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Payment Method
          </Button>
        </CardContent>
      </Card>
    );
  }

  // CANCELED
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <XCircle className="h-5 w-5 text-gray-400" />
          <Badge variant="secondary">Subscription Cancelled</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Your subscription has ended. Resubscribe to regain FMS access.
        </p>
        <Button onClick={() => setLocation("/pricing")} className="bg-orange-500 hover:bg-orange-600">
          Resubscribe
        </Button>
      </CardContent>
    </Card>
  );
}
