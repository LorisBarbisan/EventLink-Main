import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Search, Handshake, CheckCircle } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    title: "Create Your Profile",
    description: "Sign up and build your professional profile showcasing your skills, experience, and availability.",
    number: "01"
  },
  {
    icon: Search,
    title: "Find Opportunities",
    description: "Browse relevant job opportunities or get matched with positions that fit your expertise.",
    number: "02"
  },
  {
    icon: Handshake,
    title: "Connect & Apply",
    description: "Connect directly with companies, discuss requirements, and submit your applications.",
    number: "03"
  },
  {
    icon: CheckCircle,
    title: "Start Working",
    description: "Get hired and start working on exciting events while building your professional network.",
    number: "04"
  }
];

export const HowItWorksSection = () => {
  return (
    <section className="py-16 lg:py-24 bg-background">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center space-y-4 mb-16">
          <Badge variant="secondary" className="w-fit mx-auto">
            How It Works
          </Badge>
          <h2 className="text-3xl lg:text-5xl font-bold">
            Get Started in Minutes
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Our streamlined process makes it easy to connect with opportunities or find the perfect crew for your next event.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <Card key={index} className="relative overflow-hidden group hover:shadow-lg transition-all duration-300">
              <CardContent className="p-8 text-center">
                <div className="space-y-6">
                  {/* Step Number */}
                  <div className="absolute top-4 right-4 text-6xl font-bold text-muted/20 select-none">
                    {step.number}
                  </div>
                  
                  {/* Icon */}
                  <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center mx-auto relative z-10">
                    <step.icon className="w-8 h-8 text-white" />
                  </div>
                  
                  {/* Content */}
                  <div className="space-y-3 relative z-10">
                    <h3 className="text-xl font-bold">{step.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              </CardContent>
              
              {/* Connection Line (hidden on mobile) */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-primary to-transparent transform -translate-y-1/2 z-20" />
              )}
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};