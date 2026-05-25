import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, CheckCircle, AlertCircle, Users } from "lucide-react";
import type { User } from "@shared/types";
import { persistAuthSession } from "@/lib/authStorage";
import { getEffectiveCompanyId } from "@/lib/employerContext";

function emailsMatch(a: string, b: string): boolean {
  return a.toLowerCase().trim() === b.toLowerCase().trim();
}

type TokenInfo = {
  requiresAuth: boolean;
  invitedEmail: string;
  role: string;
  companyName?: string;
  accountExists?: boolean;
};

export default function JoinTeam() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, loading: authLoading, signIn, signOut, updateUser } = useAuth();
  const queryClient = useQueryClient();

  const token = new URLSearchParams(window.location.search).get("token") || "";

  const [activeTab, setActiveTab] = useState<"create" | "signin">("create");
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [freelancerBlocked, setFreelancerBlocked] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const skipAutoAcceptRef = useRef(false);

  const { data: tokenInfo, isLoading: tokenLoading, error: tokenError } = useQuery<TokenInfo>({
    queryKey: ["/api/team/accept", token],
    queryFn: () => apiRequest(`/api/team/accept/${token}`),
    enabled: !!token,
    retry: false,
  });

  const inviteEmailMatchesUser =
    !!user && !!tokenInfo && emailsMatch(user.email, tokenInfo.invitedEmail);
  const wrongAccountSignedIn =
    !!user && !!tokenInfo && !emailsMatch(user.email, tokenInfo.invitedEmail);
  const isOwnerViewingInvite =
    !!user && !!tokenInfo && getEffectiveCompanyId(user) === user.id;

  useEffect(() => {
    if (tokenInfo?.companyName) {
      setCompanyName(tokenInfo.companyName);
    }
    if (tokenInfo?.invitedEmail) {
      setSignInEmail(tokenInfo.invitedEmail);
    }
    if (tokenInfo?.accountExists) {
      setActiveTab("signin");
    }
  }, [tokenInfo]);

  const completeJoin = async (data: {
    companyName?: string;
    token?: string;
    user?: User;
  }) => {
    setAccepted(true);
    if (data.companyName) {
      setCompanyName(data.companyName);
    }
    if (data.token && data.user) {
      skipAutoAcceptRef.current = true;
      persistAuthSession(data.token, data.user);
      updateUser(data.user);
    }
    try {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/session"] });
    } catch {
      // ignore refresh errors — redirect anyway
    }
    setTimeout(() => setLocation("/dashboard"), 2500);
  };

  const acceptMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/team/accept/${token}`, {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: async (data: { companyName?: string }) => {
      try {
        const sessionData = await apiRequest("/api/auth/session", { skipAuthRedirect: true });
        if (sessionData?.user) {
          updateUser(sessionData.user);
        }
      } catch {
        // ignore refresh errors
      }
      await completeJoin({ companyName: data.companyName || companyName });
    },
    onError: (err: Error & { error?: string }) => {
      if (
        err?.message?.includes("freelancer_cannot_join_team") ||
        err?.error === "freelancer_cannot_join_team"
      ) {
        setFreelancerBlocked(true);
        return;
      }
      if (
        err?.message?.includes("owner_cannot_join_own_team") ||
        err?.message?.includes("email_mismatch")
      ) {
        return;
      }
      toast({
        title: "Failed to accept invitation",
        description: err?.message || "Please try again or contact support.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (
      inviteEmailMatchesUser &&
      tokenInfo &&
      !accepted &&
      !freelancerBlocked &&
      !registering &&
      !skipAutoAcceptRef.current
    ) {
      acceptMutation.mutate();
    }
  }, [inviteEmailMatchesUser, tokenInfo, accepted, freelancerBlocked, registering]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInfo?.invitedEmail) return;

    setRegistering(true);
    try {
      const data = await apiRequest(`/api/team/register/${token}`, {
        method: "POST",
        body: JSON.stringify({
          email: tokenInfo.invitedEmail,
          password: createPassword,
          first_name: firstName,
          last_name: lastName,
        }),
        skipAuthRedirect: true,
      });
      await completeJoin({
        companyName: data.companyName,
        token: data.token,
        user: data.user,
      });
    } catch (err: unknown) {
      const error = err as Error & { status?: number };
      if (error?.status === 409 || error?.message?.includes("account_exists")) {
        toast({
          title: "Account already exists",
          description: "Please sign in with your existing account to accept this invitation.",
        });
        setActiveTab("signin");
        return;
      }
      toast({
        title: "Failed to create account",
        description: error?.message || "Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setRegistering(false);
    }
  };

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

  if (acceptMutation.isPending && !registering) {
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
            <CardTitle className="text-lg">
              {user ? "Accept invitation" : "Join the team"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {wrongAccountSignedIn ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  {isOwnerViewingInvite ? (
                    <p>
                      This invitation was sent to{" "}
                      <span className="font-medium">{tokenInfo.invitedEmail}</span>. You are signed
                      in as the company owner ({user.email}) — you do not need to accept this link.
                    </p>
                  ) : (
                    <p>
                      This invitation was sent to{" "}
                      <span className="font-medium">{tokenInfo.invitedEmail}</span>, but you are
                      signed in as <span className="font-medium">{user.email}</span>.
                    </p>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {isOwnerViewingInvite
                    ? "Ask the invitee to open this link in their browser or email app. To test the flow yourself, sign out first."
                    : "Sign out and continue with the invited email address to accept."}
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={signingOut}
                  onClick={async () => {
                    setSigningOut(true);
                    await signOut();
                    setSigningOut(false);
                  }}
                >
                  {signingOut && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign out and continue
                </Button>
              </div>
            ) : inviteEmailMatchesUser ? (
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
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as "create" | "signin")}
              >
                <TabsList className="mb-4 grid w-full grid-cols-2">
                  <TabsTrigger value="create">Create account</TabsTrigger>
                  <TabsTrigger value="signin">Sign in</TabsTrigger>
                </TabsList>

                <TabsContent value="create">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="firstName">First name</Label>
                        <Input
                          id="firstName"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="lastName">Last name</Label>
                        <Input
                          id="lastName"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="inviteEmail">Email</Label>
                      <Input
                        id="inviteEmail"
                        type="email"
                        value={tokenInfo.invitedEmail}
                        readOnly
                        className="bg-muted"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="createPassword">Password</Label>
                      <Input
                        id="createPassword"
                        type="password"
                        value={createPassword}
                        onChange={(e) => setCreatePassword(e.target.value)}
                        required
                        minLength={8}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-orange-500 hover:bg-orange-600"
                      disabled={registering}
                    >
                      {registering && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Create account & join team
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signin">
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setSigningIn(true);
                      const { error } = await signIn(signInEmail, signInPassword);
                      setSigningIn(false);
                      if (error) {
                        toast({
                          title: "Sign in failed",
                          description: error.message || "Invalid email or password.",
                          variant: "destructive",
                        });
                      }
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
                      disabled={signingIn}
                    >
                      {signingIn && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Sign In & Accept
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
