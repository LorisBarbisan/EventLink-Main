import { Button } from "@/components/ui/button";
import eventlinkLogo from "@assets/E8-Logo-Orange-New.png";
import { ArrowRight } from "lucide-react";
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
            The Home of <span className="text-primary">Event</span>
            <span className="text-accent"> Professionals</span>
          </h1>

          <p className="text-xl leading-relaxed text-muted-foreground">
            EventLink is where freelance event professionals build trusted profiles, showcase their
            experience, and connect with the companies that power live events - get seen and grow
            your network - all in one place.
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
