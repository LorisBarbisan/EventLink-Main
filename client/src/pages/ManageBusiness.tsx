import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { usePageSeo } from "@/hooks/usePageSeo";
import { BriefcaseIcon, Calculator, Car, Package, Receipt, Send, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";

const CARDS = [
  {
    icon: BriefcaseIcon,
    title: "Keep every job in one place",
    body: "Record what you earned, who you worked for and what you're still owed. Jobs you get through EventLink are already there — add the rest in a few seconds.",
  },
  {
    icon: Receipt,
    title: "Track what it costs you",
    body: "Travel, parking, kit hire, PPE, training, your phone bill. Photograph the receipt on site and sort it out later.",
  },
  {
    icon: Car,
    title: "Log your mileage",
    body: "Two taps for a return trip to a venue you've worked before, at the current HMRC rate. It's usually the biggest deduction people forget.",
  },
  {
    icon: Send,
    title: "Send invoices that get paid",
    body: "Your details saved once, invoices built from the booking, sent and chased from here.",
  },
  {
    icon: TrendingUp,
    title: "Know where you stand",
    body: "What you've earned, what you've spent, what's outstanding and roughly what to put by for January.",
  },
  {
    icon: Package,
    title: "Give your accountant everything",
    body: "One export with your income, expenses, mileage and kit, ready for them to work from.",
  },
];

export default function ManageBusiness() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  usePageSeo(
    "Manage Your Freelance Business | EventLink",
    "Free tools to keep on top of the money — income records, expenses, mileage, invoices and exports, all in the same place as your jobs."
  );

  const handleCTA = () => {
    setLocation(user ? "/dashboard" : "/auth?tab=signup");
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600">
            <Calculator className="h-8 w-8 text-white" />
          </div>
          <h1 className="mb-4 bg-gradient-to-r from-emerald-500 to-emerald-600 bg-clip-text text-4xl font-bold text-transparent md:text-5xl">
            Run your freelance business
          </h1>
          <p className="text-xl leading-relaxed text-muted-foreground">
            Everything you need to keep on top of the money — free, for everyone
          </p>
        </div>

        {/* Feature cards */}
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {CARDS.map(({ icon: Icon, title, body }) => (
              <Card
                key={title}
                className="border-l-4 border-l-emerald-500 shadow-md transition-shadow hover:shadow-lg"
              >
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                      <Icon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
                      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Closing copy */}
          <div className="mx-auto mt-10 max-w-2xl space-y-4 rounded-xl border bg-card p-6 text-sm leading-relaxed text-muted-foreground">
            <p>
              All of this is free. We&apos;re not trying to replace your accountant — we&apos;re
              trying to make sure that when you talk to them, everything is already in one place.
            </p>
            <p>
              It also means that when a client books you, you can ask them to send the job through
              EventLink and it lands straight in your records. One place for the work, the documents
              and the money.
            </p>
          </div>

          <div className="mt-10 text-center">
            <Button
              onClick={handleCTA}
              size="lg"
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-8 py-3 text-lg font-semibold text-white hover:from-emerald-600 hover:to-emerald-700"
              data-testid="button-get-started-business"
            >
              Get started free
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
