import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";

export default function Unsubscribe() {
  const token = new URLSearchParams(window.location.search).get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error" | "no-token">(
    token ? "loading" : "no-token"
  );

  useEffect(() => {
    if (!token) return;

    fetch(`/api/auth/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(async res => {
        if (res.ok) {
          setStatus("success");
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-10 pb-10 flex flex-col items-center text-center gap-4">
          {status === "loading" && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Processing your request…</p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle className="h-12 w-12 text-green-500" />
              <h1 className="text-xl font-semibold">You've been unsubscribed</h1>
              <p className="text-muted-foreground">
                You'll no longer receive marketing emails from EventLink. Transactional emails
                (such as job application updates and messages) are not affected.
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
                This unsubscribe link is invalid or has already been used. If you believe this
                is an error, please contact us at{" "}
                <a href="mailto:admin@eventlink.one" className="underline text-primary">
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
                <a href="mailto:admin@eventlink.one" className="underline text-primary">
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
