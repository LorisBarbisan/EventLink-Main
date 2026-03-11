import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import eventlinkLogo from "@assets/E8-Logo-Orange-New.png";
import heroImg1 from "@assets/Landing_Page_optimized.jpg";
import heroImg2 from "@assets/2s_1773236252421.jpg";
import heroImg3 from "@assets/3s_1773236252421.jpg";
import heroImg4 from "@assets/4s_1773236252422.jpg";
import heroImg5 from "@assets/5s_1773236252422.jpg";
import heroImg6 from "@assets/6s_1773236252422.jpg";
import { ArrowRight, Briefcase, MapPin, Star } from "lucide-react";
import { Link } from "wouter";

const heroImages = [
  { src: heroImg1, alt: "Professional event production setup with video monitors, cameras, mixing console and stage lighting" },
  { src: heroImg2, alt: "Audio technicians patching cables into rack equipment at an outdoor festival stage" },
  { src: heroImg3, alt: "Event crew setting up staging, lighting rigs and AV equipment in a conference venue" },
  { src: heroImg4, alt: "Stage lighting rig with LED wash fixtures and spotlights on truss structure" },
  { src: heroImg5, alt: "Camera operator filming a live broadcast production with stage lighting" },
  { src: heroImg6, alt: "Aerial view of an outdoor festival stage and site infrastructure" },
];

export const HeroSection = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % heroImages.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-background via-secondary/20 to-background">
      {/* Hero Content */}
      <div className="container mx-auto px-4 py-16 lg:py-24">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          {/* Left Column - Content */}
          <div className="animate-fade-in space-y-8">
            <div className="space-y-6">
              {/* Large EventLink Logo */}
              <div className="mb-4 hidden items-center justify-center gap-4 md:flex lg:justify-start">
                <div className="relative">
                  <img
                    src={eventlinkLogo}
                    alt="EventLink Logo"
                    className="w-16 drop-shadow-lg"
                    style={{ aspectRatio: "1/1", objectFit: "contain" }}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="text-3xl font-bold text-gray-800 dark:text-gray-200">EventLink</div>
              </div>

              <Badge variant="secondary" className="hidden w-fit">
                <Star className="mr-1 h-3 w-3" />
                Trusted by 500+ companies
              </Badge>

              <h1 className="text-4xl font-bold leading-tight lg:text-6xl">
                Connect with
                <span className="text-primary"> Technical</span>
                <span className="text-accent"> Crew</span> for Events
              </h1>

              <p className="text-xl leading-relaxed text-muted-foreground">
                EventLink connects top event industry professionals with companies across the UK.
                Whether you're seeking skilled technical crew or looking for your next opportunity,
                we make professional connections that drive successful events.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col gap-4 sm:flex-row">
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

          {/* Right Column - Rotating Images & Cards */}
          <div className="animate-scale-in relative">
            <div className="relative overflow-hidden rounded-2xl shadow-lg h-[500px]">
              {heroImages.map((img, index) => (
                <img
                  key={index}
                  src={img.src}
                  alt={img.alt}
                  className="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out"
                  style={{ opacity: index === currentIndex ? 1 : 0 }}
                  loading={index === 0 ? "eager" : "lazy"}
                  decoding="async"
                />
              ))}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            </div>

            {/* Floating Job Cards - matching E8 design */}
            <Card className="animate-fade-in absolute -left-4 -top-4 hidden border-l-4 border-l-primary bg-card/95 p-3 shadow-lg backdrop-blur-sm">
              <div className="flex items-center space-x-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">Audio Engineer</div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <MapPin className="mr-1 h-3 w-3" />
                    London • £350/day
                  </div>
                </div>
              </div>
            </Card>

            <Card className="animate-fade-in absolute -bottom-4 -right-4 hidden border-l-4 border-l-accent bg-card/95 p-3 shadow-lg backdrop-blur-sm">
              <div className="flex items-center space-x-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                  <div className="h-2 w-2 rounded-full bg-accent" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">Lighting Tech</div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <MapPin className="mr-1 h-3 w-3" />
                    Manchester • 2 days
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Background Pattern */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="bg-gradient-accent absolute -right-1/2 -top-1/2 h-full w-full rounded-full opacity-5 blur-3xl" />
        <div className="bg-gradient-primary absolute -bottom-1/2 -left-1/2 h-full w-full rounded-full opacity-5 blur-3xl" />
      </div>
    </section>
  );
};
