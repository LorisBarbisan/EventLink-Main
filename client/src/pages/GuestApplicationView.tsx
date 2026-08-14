import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Briefcase, Calendar, Loader2, Mail, MapPin, User, XCircle } from "lucide-react";

interface GuestApplicationData {
  application: {
    id: number;
    status: string;
    cover_letter: string | null;
    applied_at: string;
  };
  job: {
    id: number;
    title: string;
    location: string;
  };
  freelancer: {
    user_id: number;
    name: string;
    title: string | null;
    bio: string | null;
    location: string | null;
    profile_photo_url: string | null;
    email: string | null;
  };
}

export default function GuestApplicationView() {
  const token = new URLSearchParams(window.location.search).get("token");

  const [data, setData] = useState<GuestApplicationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgradeDismissed, setUpgradeDismissed] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Missing access token.");
      setLoading(false);
      return;
    }
    fetch(`/api/applications/guest-view?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) {
          setError(json.error);
        } else {
          setData(json);
        }
      })
      .catch(() => setError("Failed to load application. Please try again."))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <Layout>
      <div className="px-4 py-10">
        <div className="mx-auto max-w-2xl space-y-6">
          {loading && (
            <div className="flex min-h-[50vh] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
          )}

          {!loading && (error || !data) && (
            <Card className="mx-auto max-w-md">
              <CardContent className="flex flex-col items-center gap-4 pb-12 pt-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                  <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Link not valid</h1>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  {error ?? "This link is invalid or has expired."}
                </p>
                <Button variant="outline" asChild>
                  <Link href="/jobs">Browse jobs</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {!loading && data && (
            <>
              {/* Soft upgrade CTA */}
              {!upgradeDismissed && (
                <div className="flex flex-col items-start justify-between gap-3 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 dark:border-purple-800 dark:bg-purple-950/30 sm:flex-row sm:items-center">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-semibold">Want a full dashboard?</span> Manage all your
                    jobs and applications in one place — free, no obligation.
                  </p>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      asChild
                      size="sm"
                      className="bg-gradient-to-r from-purple-600 to-purple-800 text-white hover:from-purple-700 hover:to-purple-900"
                    >
                      <Link href="/auth">Create free account</Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setUpgradeDismissed(true)}
                      aria-label="Dismiss"
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              )}

              {/* Job context */}
              <div>
                <p className="mb-1 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <Briefcase className="h-4 w-4" />
                  Application for
                </p>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {data.job.title}
                </h1>
                {data.job.location && (
                  <p className="mt-1 flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                    <MapPin className="h-4 w-4" />
                    {data.job.location}
                  </p>
                )}
              </div>

              {/* Applicant card */}
              <Card>
                <CardContent className="pt-6">
                  {/* Header row */}
                  <div className="mb-4 flex items-start gap-4">
                    <Avatar className="h-14 w-14 shrink-0">
                      <AvatarImage
                        src={data.freelancer.profile_photo_url ?? undefined}
                        alt={data.freelancer.name}
                      />
                      <AvatarFallback className="bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                        {data.freelancer.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                          {data.freelancer.name}
                        </h2>
                        <Badge variant="outline" className="capitalize">
                          {data.application.status}
                        </Badge>
                      </div>
                      {data.freelancer.title && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {data.freelancer.title}
                        </p>
                      )}
                      {data.freelancer.location && (
                        <p className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                          <MapPin className="h-3 w-3" />
                          {data.freelancer.location}
                        </p>
                      )}
                    </div>
                  </div>

                  <p className="mb-4 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                    <Calendar className="h-3 w-3" />
                    Applied{" "}
                    {new Date(data.application.applied_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>

                  {data.freelancer.bio && (
                    <div className="mb-4">
                      <p className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
                        About
                      </p>
                      <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                        {data.freelancer.bio}
                      </p>
                    </div>
                  )}

                  {data.application.cover_letter && (
                    <div className="mb-6">
                      <p className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
                        Cover letter
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                        {data.application.cover_letter}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-3">
                    <Button
                      asChild
                      className="bg-gradient-to-r from-purple-600 to-purple-800 text-white hover:from-purple-700 hover:to-purple-900"
                    >
                      <a
                        href={`/profile/${data.freelancer.user_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <User className="mr-2 h-4 w-4" />
                        View Full Profile
                      </a>
                    </Button>
                    {data.freelancer.email && (
                      <Button variant="outline" asChild>
                        <a
                          href={`mailto:${data.freelancer.email}?subject=${encodeURIComponent(`Re: your application for "${data.job.title}"`)}`}
                        >
                          <Mail className="mr-2 h-4 w-4" />
                          Reply by Email
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <p className="text-center text-xs text-gray-400 dark:text-gray-500">
                This link is private and was sent only to you. It expires 30 days from the
                application date.{" "}
                <Link href="/auth" className="text-purple-600 hover:underline dark:text-purple-400">
                  Create a free account
                </Link>{" "}
                for full access.
              </p>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
