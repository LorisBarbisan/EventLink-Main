import { Button } from "@/components/ui/button";
import eventlinkLogo from "@assets/E8-Logo-Orange-New.png";
import { ArrowRight, Briefcase } from "lucide-react";
import { Link } from "wouter";

export const HeroSection = () => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-background via-secondary/20 to-background">
      <div className="container mx-auto px-4 py-10 lg:py-14">
        <div className="mx-auto max-w-3xl space-y-6 text-center">
          <div className="flex items-center justify-center gap-3">
            <img
              src={eventlinkLogo}
              alt="EventLink Logo"
              className="w-14 drop-shadow-md"
              width={56}
              height={56}
              style={{ objectFit: "contain" }}
              loading="eager"
              decoding="sync"
            />
            <span className="text-3xl font-bold text-gray-800 dark:text-gray-200">EventLink</span>
          </div>

          <h1 className="text-4xl font-bold leading-tight lg:text-6xl">
            Connect with
            <span className="text-primary"> Technical</span>
            <span className="text-accent"> Crew</span> for Events
          </h1>

          <p className="text-xl leading-relaxed text-muted-foreground">
            EventLink connects top event industry professionals with companies across the UK.
            Whether you're seeking skilled technical crew or looking for your next opportunity, we
            make professional connections that drive successful events.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              className="bg-gradient-primary hover:bg-primary-hover px-8 text-lg text-white transition-all duration-200"
              asChild
            >
              <Link to="/auth?tab=signup" data-testid="button-get-started">
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="border-2 border-primary px-8 text-lg text-primary transition-all duration-200 hover:border-primary/80 hover:bg-primary/10 hover:text-primary"
              asChild
            >
              <Link to="/jobs">
                Browse Opportunities
                <Briefcase className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="bg-gradient-accent absolute -right-1/2 -top-1/2 h-full w-full rounded-full opacity-5 blur-3xl" />
        <div className="bg-gradient-primary absolute -bottom-1/2 -left-1/2 h-full w-full rounded-full opacity-5 blur-3xl" />
      </div>
    </section>
  );
};
