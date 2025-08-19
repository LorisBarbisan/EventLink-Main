import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Users, Briefcase } from "lucide-react";
import { useLocation } from "wouter";

export const CTASection = () => {
  const [, setLocation] = useLocation();

  return (
    <section className="py-16 lg:py-24 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Freelancers CTA */}
          <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-primary opacity-5 group-hover:opacity-10 transition-opacity" />
            <CardContent className="p-8 relative">
              <div className="space-y-6">
                <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center">
                  <Users className="w-8 h-8 text-primary-foreground" />
                </div>
                
                <div className="space-y-3">
                  <h3 className="text-2xl font-bold">Join as a Freelancer</h3>
                  <p className="text-muted-foreground">
                    Connect with leading event companies and find your next technical gig. 
                    Build your reputation and grow your career in the events industry.
                  </p>
                </div>

                <ul className="space-y-2 text-sm">
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-primary rounded-full mr-3" />
                    Access to exclusive job opportunities
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-primary rounded-full mr-3" />
                    Build your professional profile
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-primary rounded-full mr-3" />
                    Connect with industry professionals
                  </li>
                </ul>

                <Button 
                  className="w-full bg-gradient-primary hover:bg-primary-hover"
                  onClick={() => setLocation('/auth')}
                  data-testid="button-create-freelancer-profile"
                >
                  Create Freelancer Profile
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Companies CTA */}
          <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-accent opacity-5 group-hover:opacity-10 transition-opacity" />
            <CardContent className="p-8 relative">
              <div className="space-y-6">
                <div className="w-16 h-16 bg-gradient-accent rounded-2xl flex items-center justify-center">
                  <Briefcase className="w-8 h-8 text-accent-foreground" />
                </div>
                
                <div className="space-y-3">
                  <h3 className="text-2xl font-bold">Hire Technical Crew</h3>
                  <p className="text-muted-foreground">
                    Find qualified technical professionals for your events. 
                    Post jobs, review portfolios, and hire with confidence.
                  </p>
                </div>

                <ul className="space-y-2 text-sm">
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-accent rounded-full mr-3" />
                    Access to vetted professionals
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-accent rounded-full mr-3" />
                    Easy job posting and management
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-accent rounded-full mr-3" />
                    Secure hiring and payments
                  </li>
                </ul>

                <Button 
                  className="w-full bg-gradient-primary hover:bg-primary-hover"
                  onClick={() => setLocation('/auth')}
                  data-testid="button-post-first-job"
                >
                  Post Your First Job
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Stats */}
        <div className="mt-16 text-center hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-2xl mx-auto">
            <div>
              <div className="text-3xl font-bold text-primary mb-2">98%</div>
              <div className="text-sm text-muted-foreground">Job Success Rate</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary mb-2">24h</div>
              <div className="text-sm text-muted-foreground">Average Response Time</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary mb-2">4.9★</div>
              <div className="text-sm text-muted-foreground">Platform Rating</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};