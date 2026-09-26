import { useState } from "react";
import { Link } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CountrySelect } from "@/components/ui/country-select";
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
import { Briefcase, ChevronDown, ChevronUp, Mail } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

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
  country: z.string().optional(),
  currency: z.string().min(1),
  rate: z.string().min(1, "Rate / budget is required"),
  description: z.string().min(10, "Please add a description (at least 10 characters)"),
  event_date: z.string().optional(),
  end_date: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  terms_accepted: z.literal(true, {
    errorMap: () => ({ message: "You must accept the terms to continue" }),
  }),
});

type FormValues = z.infer<typeof schema>;

export default function PostJob() {
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showAdditional, setShowAdditional] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      contact_name: "",
      contact_email: "",
      title: "",
      company: "",
      location: "",
      country: "",
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

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      await apiRequest("/api/jobs/guest", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
      setSubmitted(true);
    } catch (err: any) {
      const msg = err?.message || "Something went wrong. Please try again.";
      setServerError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Layout>
        <div className="flex min-h-[70vh] items-center justify-center px-4">
          <Card className="w-full max-w-md">
            <CardContent className="flex flex-col items-center gap-4 pb-12 pt-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <Mail className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Check your inbox</h1>
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                We&rsquo;ve sent a confirmation link to{" "}
                <strong>{form.getValues("contact_email")}</strong>. Click it to publish your job
                post. The link expires in&nbsp;24&nbsp;hours.
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Already have an account?{" "}
                <Link href="/auth" className="text-purple-600 hover:underline">
                  Sign in
                </Link>{" "}
                to manage your posts.
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-2xl px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-purple-800">
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Post a Job</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No account needed. Fill in the details and we&rsquo;ll send you a link to confirm and
            publish.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* ── Contact details ─────────────────────────────────────────── */}
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

            {/* ── Job details ─────────────────────────────────────────────── */}
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
                            onChange={(val, locationData) => {
                              field.onChange(val);
                              if (locationData?.country) {
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
                          Country{" "}
                          <span className="text-xs font-normal text-gray-400">(optional)</span>
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
                          Rate / budget <span className="text-red-500">*</span>
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
                          Start date{" "}
                          <span className="text-xs font-normal text-gray-400">(optional)</span>
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
                        Description <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the role, requirements, and anything else freelancers should know…"
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

            {/* ── Terms ───────────────────────────────────────────────────── */}
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
                      <Link href="/privacy" className="text-purple-600 hover:underline">
                        Terms &amp; Privacy Policy
                      </Link>
                      . I understand my contact details will be used to send a confirmation link and
                      may be shared with applicants.
                    </div>
                  </div>
                  <FormMessage className="ml-7" />
                </FormItem>
              )}
            />

            {serverError && <p className="text-sm text-red-600 dark:text-red-400">{serverError}</p>}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-auto w-full bg-gradient-to-r from-purple-600 to-purple-800 py-3 font-semibold text-white hover:from-purple-700 hover:to-purple-900"
            >
              {isSubmitting ? "Sending confirmation…" : "Send confirmation email"}
            </Button>

            <p className="text-center text-xs text-gray-500 dark:text-gray-500">
              Already have an account?{" "}
              <Link href="/auth" className="text-purple-600 hover:underline">
                Sign in to post directly
              </Link>
            </p>
          </form>
        </Form>
      </div>
    </Layout>
  );
}
