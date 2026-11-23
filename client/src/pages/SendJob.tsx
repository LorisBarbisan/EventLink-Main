import { useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Loader2, Send, ChevronDown } from "lucide-react";

interface PublicProfile {
  user_id: number;
  first_name?: string | null;
  last_name?: string | null;
  title?: string | null;
  superpower?: string | null;
  profile_photo_url?: string | null;
  accepts_direct_offers?: boolean;
}

const DRAFT_TTL_HOURS = 24;

function initials(first?: string | null, last?: string | null): string {
  return `${(first ?? "").charAt(0)}${(last ?? "").charAt(0)}`.toUpperCase() || "?";
}

export default function SendJob() {
  const { slug } = useParams();
  const [showDetails, setShowDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    event_date: "",
    location: "",
    contact_name: "",
    contact_email: "",
    rate: "",
    end_date: "",
    start_time: "",
    end_time: "",
    company: "",
    notes: "",
    terms_accepted: false,
  });

  const {
    data: profile,
    isLoading,
    isError,
  } = useQuery<PublicProfile>({
    queryKey: [`/api/freelancer/${slug}`],
    queryFn: () => apiRequest(`/api/freelancer/${slug}`),
    retry: false,
    enabled: !!slug,
  });

  const set = (k: keyof typeof form) => (v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const offline = !isLoading && (isError || !profile || profile.accepts_direct_offers === false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.terms_accepted) {
      setError("Please accept the terms to continue.");
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("/api/jobs/direct", {
        method: "POST",
        body: JSON.stringify({ ...form, freelancer_slug: slug }),
        skipAuthRedirect: true,
      });
      setSent(true);
    } catch (err) {
      setError((err as Error)?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const name = profile ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() : "";
  const firstName = (profile?.first_name ?? "").trim() || "they";
  const headline = profile?.title || profile?.superpower || "";

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 dark:bg-gray-950">
      <div className="mx-auto w-full max-w-md">
        {isLoading && (
          <div className="flex min-h-[60vh] items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-purple-600" />
          </div>
        )}

        {offline && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                This link isn&rsquo;t available
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                It may have been turned off, or the address is wrong. Try asking for it again.
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !offline && profile && sent && (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Almost there!</h1>
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                We&rsquo;ve emailed you a link to confirm. {firstName} sees the job as soon as you
                click it. The link expires in {DRAFT_TTL_HOURS} hours.
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !offline && profile && !sent && (
          <Card>
            <CardContent className="pt-6">
              {/* Freelancer header */}
              <div className="mb-5 flex items-center gap-3">
                {profile.profile_photo_url ? (
                  <img
                    src={profile.profile_photo_url}
                    alt={name}
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-purple-700 text-lg font-bold text-white">
                    {initials(profile.first_name, profile.last_name)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-purple-600 dark:text-purple-400">
                    Send a job to
                  </p>
                  <h1 className="truncate text-lg font-bold text-gray-900 dark:text-white">
                    {name}
                  </h1>
                  {headline && (
                    <p className="truncate text-sm text-gray-500 dark:text-gray-400">{headline}</p>
                  )}
                </div>
              </div>

              <p className="mb-5 rounded-lg bg-purple-50 p-3 text-sm text-gray-700 dark:bg-purple-900/20 dark:text-gray-300">
                Fill in the basics and we&rsquo;ll email you a link to confirm. {firstName} sees the
                job as soon as you click it — no account needed.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Field label="What's the job?" htmlFor="title">
                  <Input
                    id="title"
                    required
                    placeholder="e.g. Sound engineer for a wedding"
                    value={form.title}
                    onChange={(e) => set("title")(e.target.value)}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Date" htmlFor="event_date">
                    <Input
                      id="event_date"
                      type="date"
                      required
                      value={form.event_date}
                      onChange={(e) => set("event_date")(e.target.value)}
                    />
                  </Field>
                  <Field label="Location" htmlFor="location">
                    <Input
                      id="location"
                      required
                      placeholder="London"
                      value={form.location}
                      onChange={(e) => set("location")(e.target.value)}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Your name" htmlFor="contact_name">
                    <Input
                      id="contact_name"
                      required
                      value={form.contact_name}
                      onChange={(e) => set("contact_name")(e.target.value)}
                    />
                  </Field>
                  <Field label="Your email" htmlFor="contact_email">
                    <Input
                      id="contact_email"
                      type="email"
                      required
                      value={form.contact_email}
                      onChange={(e) => set("contact_email")(e.target.value)}
                    />
                  </Field>
                </div>

                {/* Optional details */}
                <button
                  type="button"
                  onClick={() => setShowDetails((s) => !s)}
                  className="flex items-center gap-1 text-sm font-medium text-purple-600 dark:text-purple-400"
                >
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${showDetails ? "rotate-180" : ""}`}
                  />
                  Add details (optional)
                </button>

                {showDetails && (
                  <div className="space-y-4 rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                    <Field label="Rate / budget" htmlFor="rate">
                      <Input
                        id="rate"
                        placeholder="e.g. £250/day — leave blank to discuss"
                        value={form.rate}
                        onChange={(e) => set("rate")(e.target.value)}
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="End date" htmlFor="end_date">
                        <Input
                          id="end_date"
                          type="date"
                          value={form.end_date}
                          onChange={(e) => set("end_date")(e.target.value)}
                        />
                      </Field>
                      <Field label="Company" htmlFor="company">
                        <Input
                          id="company"
                          value={form.company}
                          onChange={(e) => set("company")(e.target.value)}
                        />
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Start time" htmlFor="start_time">
                        <Input
                          id="start_time"
                          type="time"
                          value={form.start_time}
                          onChange={(e) => set("start_time")(e.target.value)}
                        />
                      </Field>
                      <Field label="End time" htmlFor="end_time">
                        <Input
                          id="end_time"
                          type="time"
                          value={form.end_time}
                          onChange={(e) => set("end_time")(e.target.value)}
                        />
                      </Field>
                    </div>
                    <Field label="Notes" htmlFor="notes">
                      <Textarea
                        id="notes"
                        rows={3}
                        placeholder="Anything else they should know"
                        value={form.notes}
                        onChange={(e) => set("notes")(e.target.value)}
                      />
                    </Field>
                  </div>
                )}

                <label className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Checkbox
                    checked={form.terms_accepted}
                    onCheckedChange={(v) => set("terms_accepted")(Boolean(v))}
                    className="mt-0.5"
                  />
                  <span>
                    I agree to EventLink&rsquo;s{" "}
                    <a href="/terms" className="text-purple-600 hover:underline" target="_blank">
                      terms
                    </a>{" "}
                    and understand my details are shared with {name || "this freelancer"}.
                  </span>
                </label>

                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-gradient-to-r from-purple-600 to-purple-800 text-white hover:from-purple-700 hover:to-purple-900"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send the job
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-medium text-gray-700 dark:text-gray-300">
        {label}
      </Label>
      {children}
    </div>
  );
}
