import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import {
  Award,
  Bell,
  BriefcaseIcon,
  FileText,
  MessageCircle,
  Phone,
  Shield,
  UserPlus,
  Users,
} from "lucide-react";
import { usePageSeo } from "@/hooks/usePageSeo";
import { useLocation } from "wouter";

export default function HowItWorks() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  usePageSeo(
    "How EventLink Works | Freelance Events Crew Network",
    "See how EventLink connects freelance event crew with employers, step by step."
  );

  const handleFreelancerCTA = () => {
    if (user) {
      setLocation("/dashboard");
    } else {
      setLocation("/auth?tab=signup");
    }
  };

  const handleRecruiterCTA = () => {
    if (user && user.role === "recruiter") {
      setLocation("/dashboard"); // Recruiters can post jobs from dashboard
    } else if (user) {
      setLocation("/dashboard");
    } else {
      setLocation("/auth?tab=signup");
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        {/* Header Section */}
        <div className="mx-auto mb-16 max-w-4xl text-center">
          <h1 className="mb-6 bg-gradient-to-r from-primary to-orange-600 bg-clip-text text-4xl font-bold text-transparent md:text-5xl">
            How EventLink Works
          </h1>
          <p className="text-xl leading-relaxed text-muted-foreground">
            EventLink connects event professionals with opportunities across the events industry.
            Whether you&apos;re a freelancer looking for work or an employer seeking skilled
            professionals, we make the process simple and efficient.
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Section headers */}
          <div className="mb-2 grid gap-12 lg:grid-cols-2">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600">
                <UserPlus className="h-8 w-8 text-white" />
              </div>
              <h2 className="mb-4 text-3xl font-bold text-foreground">For Freelancers</h2>
              <p className="text-muted-foreground">Build your career in the events industry</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-600">
                <Users className="h-8 w-8 text-white" />
              </div>
              <h2 className="mb-4 text-3xl font-bold text-foreground">For Employers</h2>
              <p className="text-muted-foreground">Find the perfect event professionals</p>
            </div>
          </div>

          {/* Row 1 */}
          <div className="grid items-stretch gap-12 lg:grid-cols-2">
            <Card className="h-full border-l-4 border-l-blue-500 shadow-md transition-shadow hover:shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex flex-col">
                    <h3 className="mb-2 text-xl font-semibold">Create Your Profile</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Register for free, upload your CV, and highlight your skills. Showcase your
                      expertise in AV, event management, technical production, or other event
                      specialties.
                    </p>
                    <a
                      href="https://youtu.be/-V_xTPkC8UA"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 self-start text-sm text-blue-600 underline hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Watch the tutorial
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="h-full border-l-4 border-l-orange-500 shadow-md transition-shadow hover:shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
                    <BriefcaseIcon className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="flex flex-col">
                    <h3 className="mb-2 text-xl font-semibold">post jobs</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Share event roles quickly and for free. Detail your requirements, location,
                      budget, and timeline to attract the right candidates for your events.
                    </p>
                    <a
                      href="https://youtu.be/2JxKSwMq5hE"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 self-start text-sm text-orange-600 underline hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
                    >
                      Watch the tutorial
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row 2 */}
          <div className="grid items-stretch gap-12 lg:grid-cols-2">
            <Card className="h-full border-l-4 border-l-blue-500 shadow-md transition-shadow hover:shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex flex-col">
                    <h3 className="mb-2 text-xl font-semibold">Build Trust</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Invite previous clients to recommend you on EventLink and build credibility
                      through visible references. Strengthen your profile and show new clients they
                      can rely on you.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="h-full border-l-4 border-l-orange-500 shadow-md transition-shadow hover:shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
                    <Users className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="flex flex-col">
                    <h3 className="mb-2 text-xl font-semibold">Browse Freelancer Profiles</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Discover qualified AV techs, event crew, and specialists with ease. Filter by
                      location, skills, experience, and availability to find your ideal team.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row 3 */}
          <div className="grid items-stretch gap-12 lg:grid-cols-2">
            <Card className="h-full border-l-4 border-l-blue-500 shadow-md transition-shadow hover:shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <Bell className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex flex-col">
                    <h3 className="mb-2 text-xl font-semibold">Get Notified</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Set your preferences and receive alerts when roles matching your skills and
                      location go live. Stay ready to apply when the right opportunity appears.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="h-full border-l-4 border-l-orange-500 shadow-md transition-shadow hover:shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
                    <Phone className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="flex flex-col">
                    <h3 className="mb-2 text-xl font-semibold">Connect & Hire</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Review applications, message candidates directly, and confirm bookings.
                      Streamline your hiring process with our integrated communication tools.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row 4 */}
          <div className="grid items-stretch gap-12 lg:grid-cols-2">
            <Card className="h-full border-l-4 border-l-blue-500 shadow-md transition-shadow hover:shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <MessageCircle className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex flex-col">
                    <h3 className="mb-2 text-xl font-semibold">Communicate Easily</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Use our internal messaging system to stay connected with employers. Discuss
                      project details, negotiate terms, and confirm bookings all in one place.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="h-full border-l-4 border-l-orange-500 shadow-md transition-shadow hover:shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
                    <Award className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="flex flex-col">
                    <h3 className="mb-2 text-xl font-semibold">Build Your Trusted Crew</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Rate freelancers and re-hire the best professionals for future projects.
                      Create a reliable network of event specialists you can count on.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* CTA buttons */}
          <div className="grid gap-12 pt-2 lg:grid-cols-2">
            <div className="text-center">
              <Button
                onClick={handleFreelancerCTA}
                size="lg"
                className="bg-gradient-to-r from-blue-500 to-blue-600 px-8 py-3 text-lg font-semibold text-white hover:from-blue-600 hover:to-blue-700"
                data-testid="button-create-profile"
              >
                Create Your Profile
              </Button>
            </div>
            <div className="text-center">
              <Button
                onClick={handleRecruiterCTA}
                size="lg"
                className="bg-gradient-to-r from-orange-500 to-orange-600 px-8 py-3 text-lg font-semibold text-white hover:from-orange-600 hover:to-orange-700"
                data-testid="button-post-job"
              >
                Post a Job
              </Button>
            </div>
          </div>
        </div>

        {/* Bottom CTA Section */}
        <div className="mt-16 border-t border-border pt-12 text-center">
          <h3 className="mb-4 text-2xl font-bold">Ready to Get Started?</h3>
          <p className="mx-auto mb-8 max-w-2xl text-muted-foreground">
            Join thousands of event professionals who are already using EventLink to grow their
            careers and find the perfect team members.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              onClick={handleFreelancerCTA}
              size="lg"
              variant="outline"
              className="border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              data-testid="button-join-freelancer"
            >
              Join as Freelancer
            </Button>
            <Button
              onClick={handleRecruiterCTA}
              size="lg"
              variant="outline"
              className="border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
              data-testid="button-join-recruiter"
            >
              Join as Employer
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
