import { useState } from "react";
import { useParams } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CountrySelect, countryCodeFor, DEFAULT_COUNTRY } from "@/components/ui/country-select";
import { GlobalLocationInput } from "@/components/ui/global-location-input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, ChevronDown, ChevronUp, Send } from "lucide-react";

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

const CURRENCIES = [
  { code: "GBP", symbol: "£" },
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "AUD", symbol: "A$" },
  { code: "CAD", symbol: "C$" },
  { code: "ZAR", symbol: "R" },
];

const schema = z.object({
  // contact
  contact_name: z.string().min(1, "Your name is required"),
  contact_email: z.string().email("A valid email address is required"),
  // job
  title: z.string().min(1, "Job title is required"),
  company: z.string().optional(),
  location: z.string().min(1, "Location is required"),
  country: z.string().min(1, "Country is required"),
  currency: z.string().min(1),
  rate: z.string().optional(),
  description: z.string().optional(),
  event_date: z.string().min(1, "A date is required"),
  end_date: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  terms_accepted: z.literal(true, {
    errorMap: () => ({ message: "You must accept the terms to continue" }),
  }),
});

type FormValues = z.infer<typeof schema>;

function initials(first?: string | null, last?: string | null): string {
  return `${(first ?? "").charAt(0)}${(last ?? "").charAt(0)}`.toUpperCase() || "?";
}

export default function SendJob() {
  const { slug } = useParams();
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showAdditional, setShowAdditional] = useState(false);

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

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      contact_name: "",
      contact_email: "",
      title: "",
      company: "",
      location: "",
      country: DEFAULT_COUNTRY,
      currency: "GBP",
      rate: "",
      description: "",
      event_date: "",
      end_date: "",
      start_time: "",
      end_time: "",
      terms_accepted: undefined as unknown as true,
    },
  });

  const currency = form.watch("currency");
  const currencySymbol = CURRENCIES.find((c) => c.code === currency)?.symbol ?? "£";

  const offline = !isLoading && (isError || !profile || profile.accepts_direct_offers === false);

  const name = profile ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() : "";
  const firstName = (profile?.first_name ?? "").trim() || "they";
  const headline = profile?.title || profile?.superpower || "";

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      await apiRequest("/api/jobs/direct", {
        method: "POST",
        body: JSON.stringify({ ...data, freelancer_slug: slug }),
        headers: { "Content-Type": "application/json" },
        skipAuthRedirect: true,
      });
      setSubmitted(true);
    } catch (err) {
      setServerError((err as Error)?.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10 dark:bg-gray-950">
      <div className="mx-auto w-full max-w-2xl">
        {isLoading && (
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
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

        {!isLoading && !offline && profile && submitted && (
          <div className="flex min-h-[70vh] items-center justify-center">
            <Card className="w-full max-w-md">
              <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Almost there!</h1>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  We&rsquo;ve emailed you a link to confirm. {firstName} sees the job as soon as you
                  click it. The link expires in&nbsp;{DRAFT_TTL_HOURS}&nbsp;hours.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {!isLoading && !offline && profile && !submitted && (
          <>
            {/* ── Freelancer header ─────────────────────────────────────────── */}
            <div className="mb-8 flex items-center gap-3">
              {profile.profile_photo_url ? (
                <img
                  src={profile.profile_photo_url}
                  alt={name}
                  className="h-14 w-14 flex-shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-purple-800 text-lg font-bold text-white">
                  {initials(profile.first_name, profile.last_name)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-purple-600 dark:text-purple-400">
                  Send a job to
                </p>
                <h1 className="truncate text-2xl font-bold text-gray-900 dark:text-white">
                  {name}
                </h1>
                {headline && (
                  <p className="truncate text-sm text-gray-500 dark:text-gray-400">{headline}</p>
                )}
              </div>
            </div>

            <p className="mb-6 rounded-lg bg-purple-50 p-3 text-sm text-gray-700 dark:bg-purple-900/20 dark:text-gray-300">
              No account needed. Fill in the details and we&rsquo;ll email you a link to confirm.{" "}
              {firstName} sees the job as soon as you click it.
            </p>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* ── Contact details ─────────────────────────────────────── */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Your contact details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="contact_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Your name <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="Jane Smith" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="contact_email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Email address <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="jane@company.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* ── Job details ─────────────────────────────────────────── */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Job details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Job title <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Sound Engineer" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="company"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Company / organisation{" "}
                            <span className="text-xs font-normal text-gray-400">(optional)</span>
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Acme Productions" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Location + Country */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="location"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Location <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <GlobalLocationInput
                                value={field.value}
                                countryCode={countryCodeFor(form.watch("country"))}
                                onChange={(val, locationData) => {
                                  field.onChange(val);
                                  if (locationData?.country && !form.getValues("country")) {
                                    form.setValue("country", locationData.country, {
                                      shouldValidate: false,
                                    });
                                  }
                                }}
                                placeholder="e.g. London, UK"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="country"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Country <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <CountrySelect value={field.value ?? ""} onChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Currency + Rate + Event date */}
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="currency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Currency</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {CURRENCIES.map((c) => (
                                  <SelectItem key={c.code} value={c.code}>
                                    {c.symbol} {c.code}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="rate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Rate / budget{" "}
                              <span className="text-xs font-normal text-gray-400">(optional)</span>
                            </FormLabel>
                            <FormControl>
                              <Input placeholder={`${currencySymbol}250/day`} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="event_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Date <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Description{" "}
                            <span className="text-xs font-normal text-gray-400">(optional)</span>
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe the role, requirements, and anything else they should know…"
                              rows={5}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Additional details collapsible */}
                    <button
                      type="button"
                      onClick={() => setShowAdditional((v) => !v)}
                      className="flex items-center gap-1 text-sm text-purple-600 hover:underline dark:text-purple-400"
                    >
                      {showAdditional ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                      {showAdditional ? "Hide" : "Add"} optional details (end date, times)
                    </button>

                    {showAdditional && (
                      <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-3">
                        <FormField
                          control={form.control}
                          name="end_date"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>End date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="start_time"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Start time</FormLabel>
                              <FormControl>
                                <Input type="time" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="end_time"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>End time</FormLabel>
                              <FormControl>
                                <Input type="time" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* ── Terms ───────────────────────────────────────────────── */}
                <FormField
                  control={form.control}
                  name="terms_accepted"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-start gap-3">
                        <FormControl>
                          <Checkbox
                            checked={field.value === true}
                            onCheckedChange={(checked) =>
                              field.onChange(checked === true ? true : undefined)
                            }
                            className="mt-0.5"
                          />
                        </FormControl>
                        <div className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                          I agree to EventLink&rsquo;s{" "}
                          <a
                            href="/privacy"
                            className="text-purple-600 hover:underline"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Terms &amp; Privacy Policy
                          </a>
                          . I understand my contact details are shared with{" "}
                          {name || "this freelancer"}.
                        </div>
                      </div>
                      <FormMessage className="ml-7" />
                    </FormItem>
                  )}
                />

                {serverError && (
                  <p className="text-sm text-red-600 dark:text-red-400">{serverError}</p>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-auto w-full bg-gradient-to-r from-purple-600 to-purple-800 py-3 font-semibold text-white hover:from-purple-700 hover:to-purple-900"
                >
                  {isSubmitting ? (
                    "Sending…"
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Send className="h-4 w-4" />
                      Send the job
                    </span>
                  )}
                </Button>
              </form>
            </Form>
          </>
        )}
      </div>
    </div>
  );
}
