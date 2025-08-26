import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Briefcase, 
  Shield, 
  Search, 
  Clock, 
  Award,
  MessageSquare,
  TrendingUp 
} from "lucide-react";

const freelancerFeatures = [
  {
    icon: Search,
    title: "Smart Job Matching",
    description: "Get matched with relevant opportunities based on your skills, location, and availability."
  },
  {
    icon: Clock,
    title: "Flexible Scheduling",
    description: "Choose when and where you work. Perfect for balancing multiple projects and commitments."
  },
  {
    icon: Award,
    title: "Build Your Reputation",
    description: "Showcase your skills, collect reviews, and build a professional profile that stands out."
  },
  {
    icon: TrendingUp,
    title: "Career Growth",
    description: "Access training resources and advance your career in the events industry."
  }
];

const companyFeatures = [
  {
    icon: Users,
    title: "Verified Professionals",
    description: "Access a curated network of experienced technical crew with verified skills and backgrounds."
  },
  {
    icon: Briefcase,
    title: "Easy Job Posting",
    description: "Post jobs quickly with our streamlined process and reach qualified candidates instantly."
  },
  {
    icon: Shield,
    title: "Secure Hiring",
    description: "Built-in verification, reviews, and secure payment processing for peace of mind."
  },
  {
    icon: MessageSquare,
    title: "Direct Communication",
    description: "Connect directly with freelancers, discuss requirements, and coordinate seamlessly."
  }
];

export const FeaturesSection = () => {
  return (
    <section className="py-16 lg:py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center space-y-4 mb-16">
          <Badge variant="secondary" className="w-fit mx-auto">
            Why Choose E8
          </Badge>
          <h2 className="text-3xl lg:text-5xl font-bold">
            Built for the Events Industry
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Whether you're a freelance technician looking for your next gig or a company seeking skilled crew, 
            we've designed the perfect platform for the corporate events sector.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* For Freelancers */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h3 className="text-2xl font-bold flex items-center">
                <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center mr-3">
                  <Users className="w-4 h-4 text-primary-foreground" />
                </div>
                For Freelancers
              </h3>
              <p className="text-muted-foreground">
                Take control of your career with tools designed for technical professionals.
              </p>
            </div>

            <div className="space-y-4">
              {freelancerFeatures.map((feature, index) => (
                <Card key={index} className="hover:shadow-card transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <feature.icon className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">{feature.title}</h4>
                        <p className="text-sm text-muted-foreground">{feature.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* For Companies */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h3 className="text-2xl font-bold flex items-center">
                <div className="w-8 h-8 bg-gradient-accent rounded-lg flex items-center justify-center mr-3">
                  <Briefcase className="w-4 h-4 text-accent-foreground" />
                </div>
                For Companies
              </h3>
              <p className="text-muted-foreground">
                Find and hire the best technical talent for your events with confidence.
              </p>
            </div>

            <div className="space-y-4">
              {companyFeatures.map((feature, index) => (
                <Card key={index} className="hover:shadow-card transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <feature.icon className="w-6 h-6 text-accent" />
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">{feature.title}</h4>
                        <p className="text-sm text-muted-foreground">{feature.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};