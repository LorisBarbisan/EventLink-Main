import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, CheckCircle, AlertCircle, Users } from "lucide-react";

export default function JoinTeam() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const token = new URLSearchParams(window.location.search).get("token") || "";

  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [freelancerBlocked, setFreelancerBlocked] = useState(false);

  const { data: tokenInfo, isLoading: tokenLoading, error: tokenError } = useQuery<{
    requiresAuth: boolean;
    invitedEmail: string;
    role: string;
    companyName?: string;
  }>({
    queryKey: ["/api/team/accept", token],
    queryFn: () => apiRequest(`/api/team/accept/${token}`),
    enabled: !!token,
    retry: false,
  });

  useEffect(() => {
    if (tokenInfo?.companyName) {
      setCompanyName(tokenInfo.companyName);
    }
  }, [tokenInfo]);

  const signInMutation = useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      apiRequest("/api/auth/signin", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: (data: any) => {
      if (data.token) {
        localStorage.setItem("auth_token", data.token);
        window.location.reload();
      }
    },
    onError: (err: any) => {
      toast({
        title: "Sign in failed",
        description: err?.message || "Invalid email or password.",
        variant: "destructive",
      });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/team/accept/${token}`, {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: async (data: any) => {
      setAccepted(true);
      setCompanyName(data.companyName || companyName);
      // Refresh auth session so the dashboard receives updated companyId/isTeamMember
      try {
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/session"] });
        await queryClient.refetchQueries({ queryKey: ["/api/auth/session"] });
      } catch {
        // ignore refresh errors — redirect anyway
      }
      setTimeout(() => setLocation("/dashboard"), 2500);
    },
    onError: (err: any) => {
      if (err?.message?.includes("freelancer_cannot_join_team") || err?.error === "freelancer_cannot_join_team") {
        setFreelancerBlocked(true);
        return;
      }
      // Try parsing the error body for the error code
      try {
        const parsed = typeof err === "string" ? JSON.parse(err) : err;
        if (parsed?.error === "freelancer_cannot_join_team") {
          setFreelancerBlocked(true);
          return;
        }
      } catch {}
      toast({
        title: "Failed to accept invitation",
        description: err?.message || "Please try again or contact support.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (user && tokenInfo && !accepted && !freelancerBlocked) {
      acceptMutation.mutate();
    }
  }, [user, tokenInfo]);

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
            <h2 className="text-xl font-semibold">Invalid invitation link</h2>
            <p className="mt-2 text-muted-foreground">
              This link appears to be invalid or incomplete. Please check your email and try again.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Need help?{" "}
              <a href="mailto:loris@eventlink.one" className="text-orange-500 hover:underline">
                loris@eventlink.one
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (tokenLoading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (tokenError || !tokenInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
            <h2 className="text-xl font-semibold">Invitation expired or invalid</h2>
            <p className="mt-2 text-muted-foreground">
              This invitation link may have expired (links are valid for 7 days) or has already been used.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Contact{" "}
              <a href="mailto:loris@eventlink.one" className="text-orange-500 hover:underline">
                loris@eventlink.one
              </a>{" "}
              for a new invitation.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center">
            <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
            <h2 className="text-xl font-semibold">Welcome to the team!</h2>
            <p className="mt-2 text-muted-foreground">
              You have joined{companyName ? ` ${companyName}` : " the team"} on EventLink. Redirecting to your dashboard...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (acceptMutation.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-orange-500" />
          <p className="text-muted-foreground">Accepting invitation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-muted/30">
      {/* Freelancer blocked modal */}
      {freelancerBlocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
            <div className="mb-4 text-5xl">🚫</div>
            <h2 className="mb-3 text-xl font-bold text-gray-900">
              This invitation is for employer accounts
            </h2>
            <p className="mb-4 text-sm leading-relaxed text-gray-500">
              Your account is registered as a freelancer on EventLink. Team invitations can only be accepted by employer accounts.
            </p>
            <p className="mb-6 text-sm leading-relaxed text-gray-500">
              If you need to join this company's team, please register a separate employer account using a different email address, then accept the invitation from there.
            </p>
            <a
              href="/dashboard"
              className="block w-full rounded-xl bg-orange-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-orange-700"
            >
              Back to my dashboard
            </a>
          </div>
        </div>
      )}

      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
            <Users className="h-8 w-8 text-orange-600" />
          </div>
          <h1 className="text-2xl font-bold">You've been invited</h1>
          {tokenInfo.companyName && (
            <p className="mt-1 text-muted-foreground">
              Join <span className="font-semibold">{tokenInfo.companyName}</span> on EventLink as{" "}
              <span className="font-semibold capitalize">{tokenInfo.role}</span>
            </p>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sign in to accept</CardTitle>
          </CardHeader>
          <CardContent>
            {user ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  You're signed in as <span className="font-medium">{user.email}</span>.
                </p>
                <Button
                  className="w-full bg-orange-500 hover:bg-orange-600"
                  onClick={() => acceptMutation.mutate()}
                  disabled={acceptMutation.isPending}
                >
                  {acceptMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Accept Invitation
                </Button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  signInMutation.mutate({ email: signInEmail, password: signInPassword });
                }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    placeholder={tokenInfo.invitedEmail || "your@email.com"}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-orange-500 hover:bg-orange-600"
                  disabled={signInMutation.isPending}
                >
                  {signInMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Sign In & Accept
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Don't have an account?{" "}
                  <a
                    href={`/auth?redirect=/join-team?token=${token}`}
                    className="text-orange-500 hover:underline"
                  >
                    Create one
                  </a>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
