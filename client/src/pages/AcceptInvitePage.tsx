import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Loader2, Users } from "lucide-react";
import { Link } from "wouter";

interface AuthStatus {
  user: { id: number } | null;
}

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: authData, isLoading: authLoading } = useQuery<AuthStatus>({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiRequest("/api/auth/me").catch(() => ({ user: null })),
    retry: false,
  });

  const isLoggedIn = !authLoading && !!authData?.user;

  useEffect(() => {
    if (!authLoading && isLoggedIn && token) {
      setProcessing(true);
      window.location.href = `/api/team/accept-invite/${token}`;
    }
  }, [isLoggedIn, authLoading, token]);

  if (authLoading || processing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          <p className="text-muted-foreground">Processing your invitation…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center">
          <Users className="h-8 w-8 text-orange-600" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">You've been invited to join a team on EventLink</h1>
          <p className="text-muted-foreground">
            Please sign in or create an account to accept this invitation.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Link href={`/login?redirect=/team/accept-invite/${token}`} className="flex-1">
            <Button variant="outline" className="w-full">
              Sign in
            </Button>
          </Link>
          <Link href={`/register?redirect=/team/accept-invite/${token}`} className="flex-1">
            <Button className="w-full bg-orange-500 hover:bg-orange-600">
              Create account
            </Button>
          </Link>
        </div>

        <p className="text-xs text-muted-foreground">
          Invitation links expire after 7 days.
        </p>
      </div>
    </div>
  );
}
