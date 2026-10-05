import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, Calendar, Building, ArrowRight } from "lucide-react";

const featuredJobs = [
  {
    id: 1,
    title: "Senior Audio Engineer",
    company: "Premier Events Ltd",
    location: "London",
    type: "Full Event",
    rate: "£400",
    period: "per day",
    duration: "3 days",
    date: "Dec 15-17, 2024",
    skills: ["Audio Mixing", "Live Sound", "Pro Tools", "Dante"],
    urgent: false,
    description: "Leading audio engineer needed for high-profile tech conference at ExCeL London.",
  },
  {
    id: 2,
    title: "Lighting Technician",
    company: "Brilliant Productions",
    location: "Manchester",
    type: "Setup & Strike",
    rate: "£280",
    period: "per day",
    duration: "2 days",
    date: "Dec 20-21, 2024",
    skills: ["LED Systems", "Moving Lights", "grandMA2"],
    urgent: true,
    description: "Experienced lighting tech for awards ceremony at Manchester Central.",
  },
  {
    id: 3,
    title: "AV Technician",
    company: "TechCorp Events",
    location: "Birmingham",
    type: "Full Event",
    rate: "£320",
    period: "per day",
    duration: "1 day",
    date: "Jan 8, 2025",
    skills: ["Video Switching", "Projection", "IMAG"],
    urgent: false,
    description: "Multi-camera video production for executive meeting and live streaming.",
  },
  {
    id: 4,
    title: "Project Manager",
    company: "Elite Event Solutions",
    location: "London",
    type: "Full Project",
    rate: "£500",
    period: "per day",
    duration: "5 days",
    date: "Jan 15-19, 2025",
    skills: ["Project Management", "Client Relations", "Budget Management"],
    urgent: false,
    description: "Lead technical production for international pharmaceutical conference.",
  },
];

export const JobListings = () => {
  return (
    <section className="hidden py-16 lg:py-24">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="mb-12 flex items-center justify-between">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold lg:text-4xl">Featured Jobs</h2>
            <p className="text-muted-foreground">Latest opportunities from top event companies</p>
          </div>
          <Button variant="outline" className="hidden md:flex">
            View All Jobs
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {/* Jobs Grid */}
        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {featuredJobs.map((job) => (
            <Card
              key={job.id}
              className="transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
            >
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-semibold">{job.title}</h3>
                      {job.urgent && (
                        <Badge variant="destructive" className="text-xs">
                          Urgent
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center text-muted-foreground">
                      <Building className="mr-2 h-4 w-4" />
                      <span className="text-sm">{job.company}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-primary">{job.rate}</div>
                    <div className="text-xs text-muted-foreground">{job.period}</div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{job.description}</p>

                {/* Job Details */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center text-muted-foreground">
                    <MapPin className="mr-2 h-4 w-4" />
                    {job.location}
                  </div>
                  <div className="flex items-center text-muted-foreground">
                    <Clock className="mr-2 h-4 w-4" />
                    {job.duration}
                  </div>
                  <div className="flex items-center text-muted-foreground">
                    <Calendar className="mr-2 h-4 w-4" />
                    {job.date}
                  </div>
                </div>

                {/* Skills */}
                <div className="flex flex-wrap gap-2">
                  {job.skills.map((skill, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex space-x-3 pt-2">
                  <Button className="bg-gradient-primary hover:bg-primary-hover flex-1">
                    Apply Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Mobile View All Button */}
        <div className="text-center md:hidden">
          <Button variant="outline">
            View All Jobs
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
};
