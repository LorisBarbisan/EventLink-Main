import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { ArrowRight, Users, Briefcase, Star, MapPin, Clock } from "lucide-react";
import eventImage from "@assets/vecteezy_blurred-images-of-trade-fairs-in-the-big-hall-image-of_33496157_1753859139754.jpg";
import eventlinkLogo from "@assets/E8 LOGO_1756038316799.png";


export const HeroSection = () => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-background via-secondary/20 to-background">
      {/* Hero Content */}
      <div className="container mx-auto px-4 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Content */}
          <div className="space-y-8 animate-fade-in">
            <div className="space-y-6">
              {/* Large EventLink Logo */}
              <div className="flex justify-center lg:justify-start mb-4 items-center gap-4">
                <div className="relative">
                  <img 
                    src={eventlinkLogo} 
                    alt="E8 Logo" 
                    className="w-16 h-16 drop-shadow-lg"
                  />
                </div>
                <div className="text-3xl font-bold text-gray-800 dark:text-gray-200">
                  Event Link
                </div>
              </div>

              <Badge variant="secondary" className="w-fit hidden">
                <Star className="w-3 h-3 mr-1" />
                Trusted by 500+ companies
              </Badge>
              
              <h1 className="text-4xl lg:text-6xl font-bold leading-tight">
                Connect with 
                <span className="text-primary"> Technical</span>
                <span className="text-accent"> Crew</span> for Events
              </h1>
              
              <p className="text-xl text-muted-foreground leading-relaxed">
                <strong>EventLink</strong> connects top event industry professionals with companies worldwide. 
                Whether you're seeking skilled technical crew or looking for your next opportunity, 
                we make professional connections that drive successful events.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="bg-blue-500 hover:bg-blue-600 text-white text-lg px-8 transition-all duration-200" asChild>
                <Link to="/auth">
                  Get Started
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
              
              <Button variant="outline" size="lg" className="text-lg px-8 border-2 border-blue-500 text-blue-500 hover:bg-blue-50 hover:border-blue-600 hover:text-blue-600 transition-all duration-200" asChild>
                <Link to="/jobs">
                  Browse Opportunities
                  <Briefcase className="w-5 h-5 ml-2" />
                </Link>
              </Button>
            </div>


          </div>

          {/* Right Column - Image & Cards */}
          <div className="relative animate-scale-in">
            <div className="relative rounded-2xl overflow-hidden shadow-lg">
              <img 
                src={eventImage} 
                alt="Professional trade fair and exhibition hall with lighting and event displays"
                className="w-full h-[500px] object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            </div>

            {/* Floating Job Cards - matching E8 design */}
            <Card className="absolute -top-4 -left-4 p-3 shadow-lg bg-card/95 backdrop-blur-sm animate-fade-in border-l-4 border-l-primary hidden">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                  <div className="w-2 h-2 bg-primary rounded-full" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-foreground">Audio Engineer</div>
                  <div className="text-xs text-muted-foreground flex items-center">
                    <MapPin className="w-3 h-3 mr-1" />
                    London • £350/day
                  </div>
                </div>
              </div>
            </Card>

            <Card className="absolute -bottom-4 -right-4 p-3 shadow-lg bg-card/95 backdrop-blur-sm animate-fade-in border-l-4 border-l-accent hidden">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center">
                  <div className="w-2 h-2 bg-accent rounded-full" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-foreground">Lighting Tech</div>
                  <div className="text-xs text-muted-foreground flex items-center">
                    <MapPin className="w-3 h-3 mr-1" />
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
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-accent opacity-5 rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-primary opacity-5 rounded-full blur-3xl" />
      </div>
    </section>
  );
};