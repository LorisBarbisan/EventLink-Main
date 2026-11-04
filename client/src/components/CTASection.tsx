import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Users, Briefcase } from "lucide-react";
import { useLocation } from "wouter";

export const CTASection = () => {
  const [, setLocation] = useLocation();

  return (
    <section className="bg-gradient-to-br from-primary/5 via-background to-accent/5 py-16 lg:py-24">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Freelancers CTA */}
          <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg">
            <div className="bg-gradient-primary absolute inset-0 opacity-5 transition-opacity group-hover:opacity-10" />
            <CardContent className="relative p-8">
              <div className="space-y-6">
                <div className="bg-gradient-primary flex h-16 w-16 items-center justify-center rounded-2xl">
                  <Users className="h-8 w-8 text-primary-foreground" />
                </div>

                <div className="space-y-3">
                  <h3 className="text-2xl font-bold">Join as a Freelancer</h3>
                  <p className="text-muted-foreground">
                    Connect with leading event companies and find your next gig. Build your
                    reputation and grow your career in the events industry.
                  </p>
                </div>

                <ul className="space-y-2 text-sm">
                  <li className="flex items-center">
                    <div className="mr-3 h-2 w-2 rounded-full bg-primary" />
                    Access to exclusive job opportunities
                  </li>
                  <li className="flex items-center">
                    <div className="mr-3 h-2 w-2 rounded-full bg-primary" />
                    Build your professional profile
                  </li>
                  <li className="flex items-center">
                    <div className="mr-3 h-2 w-2 rounded-full bg-primary" />
                    Connect with industry professionals
                  </li>
                </ul>

                <Button
                  className="bg-gradient-primary hover:bg-primary-hover w-full"
                  onClick={() => setLocation("/auth")}
                  data-testid="button-create-freelancer-profile"
                >
                  Create Freelancer Profile
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Companies CTA */}
          <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg">
            <div className="bg-gradient-accent absolute inset-0 opacity-5 transition-opacity group-hover:opacity-10" />
            <CardContent className="relative p-8">
              <div className="space-y-6">
                <div className="bg-gradient-accent flex h-16 w-16 items-center justify-center rounded-2xl">
                  <Briefcase className="h-8 w-8 text-accent-foreground" />
                </div>

                <div className="space-y-3">
                  <h3 className="text-2xl font-bold">Hire Technical Crew</h3>
                  <p className="text-muted-foreground">
                    Find qualified professionals for your events. Post jobs, review profiles, and
                    hire with confidence.
                  </p>
                </div>

                <ul className="space-y-2 text-sm">
                  <li className="flex items-center">
                    <div className="mr-3 h-2 w-2 rounded-full bg-accent" />
                    Access to vetted professionals
                  </li>
                  <li className="flex items-center">
                    <div className="mr-3 h-2 w-2 rounded-full bg-accent" />
                    Easy job posting and management
                  </li>
                  <li className="flex items-center">
                    <div className="mr-3 h-2 w-2 rounded-full bg-accent" />
                    Secure hiring and payments
                  </li>
                </ul>

                <Button
                  className="bg-gradient-primary hover:bg-primary-hover w-full"
                  onClick={() => setLocation("/auth")}
                  data-testid="button-post-first-job"
                >
                  Post Your First Job
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Stats */}
        <div className="mt-16 hidden text-center">
          <div className="mx-auto grid max-w-2xl grid-cols-1 gap-8 md:grid-cols-3">
            <div>
              <div className="mb-2 text-3xl font-bold text-primary">98%</div>
              <div className="text-sm text-muted-foreground">Job Success Rate</div>
            </div>
            <div>
              <div className="mb-2 text-3xl font-bold text-primary">24h</div>
              <div className="text-sm text-muted-foreground">Average Response Time</div>
            </div>
            <div>
              <div className="mb-2 text-3xl font-bold text-primary">4.9★</div>
              <div className="text-sm text-muted-foreground">Platform Rating</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
