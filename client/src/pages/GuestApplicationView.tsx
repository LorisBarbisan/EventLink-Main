import { useEffect, useState } from "react";
import { Briefcase, Calendar, Mail, MapPin, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="mb-2 text-xl font-bold">Link not valid</h1>
          <p className="text-muted-foreground">{error ?? "This link is invalid or has expired."}</p>
        </div>
      </div>
    );
  }

  const { application, job, freelancer } = data;
  const initials = freelancer.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const appliedDate = new Date(application.applied_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Soft upgrade CTA */}
        {!upgradeDismissed && (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="text-sm text-foreground">
              <span className="font-semibold">Want a full dashboard?</span> Manage all your jobs and
              applications in one place — free, no obligation.
            </p>
            <div className="flex shrink-0 gap-2">
              <Button asChild size="sm">
                <a href="/auth?tab=signup">Create account</a>
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

        {/* Job title */}
        <div>
          <p className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Briefcase className="h-4 w-4" />
            Application for
          </p>
          <h1 className="text-2xl font-bold">{job.title}</h1>
          {job.location && (
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {job.location}
            </p>
          )}
        </div>

        {/* Applicant card */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-4 pb-2">
            <Avatar className="h-14 w-14">
              <AvatarImage src={freelancer.profile_photo_url ?? undefined} alt={freelancer.name} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <CardTitle className="text-lg">{freelancer.name}</CardTitle>
              {freelancer.title && (
                <p className="text-sm text-muted-foreground">{freelancer.title}</p>
              )}
              {freelancer.location && (
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {freelancer.location}
                </p>
              )}
            </div>
            <Badge variant="outline" className="shrink-0 capitalize">
              {application.status}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              Applied {appliedDate}
            </p>

            {freelancer.bio && (
              <div>
                <p className="mb-1 text-sm font-semibold">About</p>
                <p className="text-sm text-muted-foreground">{freelancer.bio}</p>
              </div>
            )}

            {application.cover_letter && (
              <div>
                <p className="mb-1 text-sm font-semibold">Cover letter</p>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {application.cover_letter}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild>
                <a
                  href={`/profile/${freelancer.user_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <User className="mr-2 h-4 w-4" />
                  View Full Profile
                </a>
              </Button>
              {freelancer.email && (
                <Button variant="outline" asChild>
                  <a
                    href={`mailto:${freelancer.email}?subject=Re: your application for ${encodeURIComponent(job.title)}`}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Reply by Email
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          This link is private and was sent only to you. It expires 30 days from the application
          date.{" "}
          <a href="/auth?tab=signup" className="text-primary underline-offset-4 hover:underline">
            Create a free account
          </a>{" "}
          for full access.
        </p>
      </div>
    </div>
  );
}
