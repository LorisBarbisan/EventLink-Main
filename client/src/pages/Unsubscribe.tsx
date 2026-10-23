import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";

export default function Unsubscribe() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const type = params.get("type"); // "credentials" → credential reminders, else marketing
  const isCredentials = type === "credentials";

  const [status, setStatus] = useState<"loading" | "success" | "error" | "no-token">(
    token ? "loading" : "no-token"
  );

  useEffect(() => {
    if (!token) return;

    const url =
      `/api/auth/unsubscribe?token=${encodeURIComponent(token)}` +
      (type ? `&type=${encodeURIComponent(type)}` : "");
    fetch(url)
      .then(async (res) => {
        if (res.ok) {
          setStatus("success");
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 pb-10 pt-10 text-center">
          {status === "loading" && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Processing your request…</p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle className="h-12 w-12 text-green-500" />
              <h1 className="text-xl font-semibold">You&apos;ve been unsubscribed</h1>
              <p className="text-muted-foreground">
                {isCredentials
                  ? "You'll no longer receive credential expiry reminders. You can turn them back on anytime from your notification settings — and your certificate statuses still show on your profile."
                  : "You'll no longer receive marketing emails from EventLink. Transactional emails (such as job application updates and messages) are not affected."}
              </p>
              <Button asChild variant="outline" className="mt-2">
                <Link href="/">Back to EventLink</Link>
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="h-12 w-12 text-destructive" />
              <h1 className="text-xl font-semibold">Link not recognised</h1>
              <p className="text-muted-foreground">
                This unsubscribe link is invalid or has already been used. If you believe this is an
                error, please contact us at{" "}
                <a href="mailto:admin@eventlink.one" className="text-primary underline">
                  admin@eventlink.one
                </a>
                .
              </p>
              <Button asChild variant="outline" className="mt-2">
                <Link href="/">Back to EventLink</Link>
              </Button>
            </>
          )}

          {status === "no-token" && (
            <>
              <XCircle className="h-12 w-12 text-muted-foreground" />
              <h1 className="text-xl font-semibold">Missing unsubscribe link</h1>
              <p className="text-muted-foreground">
                Please use the unsubscribe link from your email. If you need help, contact us at{" "}
                <a href="mailto:admin@eventlink.one" className="text-primary underline">
                  admin@eventlink.one
                </a>
                .
              </p>
              <Button asChild variant="outline" className="mt-2">
                <Link href="/">Back to EventLink</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
