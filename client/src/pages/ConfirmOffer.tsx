import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, XCircle, AlertCircle } from "lucide-react";

type Status = "loading" | "success" | "already_consumed" | "expired" | "invalid" | "error";

export default function ConfirmOffer() {
  const token = new URLSearchParams(window.location.search).get("token");
  const [status, setStatus] = useState<Status>(token ? "loading" : "invalid");

  useEffect(() => {
    if (!token) return;

    fetch(`/api/jobs/direct/confirm?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (res.ok) {
          setStatus("success");
        } else if (res.status === 409) {
          setStatus("already_consumed");
        } else if (res.status === 410) {
          setStatus("expired");
        } else if (res.status === 404) {
          setStatus("invalid");
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <Layout>
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 pb-12 pt-12 text-center">
            {status === "loading" && (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
                <p className="text-gray-600 dark:text-gray-400">Sending your offer…</p>
              </>
            )}

            {status === "success" && (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Your offer is on its way!
                </h1>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  They&rsquo;ll see it in their dashboard and can accept or decline. We&rsquo;ve
                  emailed you a confirmation with a link to set a password and track it.
                </p>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                  Want to message directly and send more offers?{" "}
                  <Link href="/auth" className="text-purple-600 hover:underline">
                    Create a free account
                  </Link>{" "}
                  using the same email address.
                </p>
              </>
            )}

            {status === "already_consumed" && (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <AlertCircle className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Already sent</h1>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  This confirmation link has already been used. Your offer is on its way.
                </p>
              </>
            )}

            {status === "expired" && (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                  <XCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Link expired</h1>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  This confirmation link expired after 24 hours. Please send the offer again from
                  the freelancer&rsquo;s page.
                </p>
              </>
            )}

            {(status === "invalid" || status === "error") && (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                  <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  {status === "invalid" ? "Invalid link" : "Something went wrong"}
                </h1>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  {status === "invalid"
                    ? "This confirmation link is not valid. Please check the link in your email."
                    : "We couldn't send your offer. Please try again or contact support if the problem persists."}
                </p>
                <Button variant="outline" asChild>
                  <Link href="/">Back to EventLink</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
