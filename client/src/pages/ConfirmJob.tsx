import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, XCircle, AlertCircle } from "lucide-react";

type Status = "loading" | "success" | "already_consumed" | "expired" | "invalid" | "error";

export default function ConfirmJob() {
  const token = new URLSearchParams(window.location.search).get("token");
  const [status, setStatus] = useState<Status>(token ? "loading" : "invalid");
  const [jobId, setJobId] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;

    fetch(`/api/jobs/guest/confirm?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setJobId(data.job_id ?? null);
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
                <p className="text-gray-600 dark:text-gray-400">Publishing your job…</p>
              </>
            )}

            {status === "success" && (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Your job is live!
                </h1>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  Freelancers can now find and apply for your post. We&rsquo;ve sent a confirmation
                  to your email with a link to view it.
                </p>
                {jobId && (
                  <Button
                    asChild
                    className="bg-gradient-to-r from-purple-600 to-purple-800 text-white hover:from-purple-700 hover:to-purple-900"
                  >
                    <Link href={`/jobs/${jobId}`}>View your job post</Link>
                  </Button>
                )}
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                  Want to manage applications and re-post jobs in future?{" "}
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
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Already published
                </h1>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  This confirmation link has already been used. Your job post is live.
                </p>
                <Button variant="outline" asChild>
                  <Link href="/jobs">Browse jobs</Link>
                </Button>
              </>
            )}

            {status === "expired" && (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                  <XCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Link expired</h1>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  This confirmation link expired after 24 hours. Please submit your job post again.
                </p>
                <Button
                  asChild
                  className="bg-gradient-to-r from-purple-600 to-purple-800 text-white hover:from-purple-700 hover:to-purple-900"
                >
                  <Link href="/post-job">Post a new job</Link>
                </Button>
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
                    ? "This confirmation link is not valid. Please check the link in your email or submit a new job post."
                    : "We couldn't publish your job. Please try again or contact support if the problem persists."}
                </p>
                <Button variant="outline" asChild>
                  <Link href="/post-job">Try again</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
