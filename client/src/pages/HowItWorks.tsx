import { useLocation } from 'wouter';
import { useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { UserPlus, BriefcaseIcon, MessageCircle, Star, FileText, Users, Phone, Award } from 'lucide-react';

export default function HowItWorks() {
  const [, setLocation] = useLocation();
  const { user } = useOptimizedAuth();

  // Set SEO metadata for this page
  useEffect(() => {
    // Update document title
    document.title = "How Does It Work - EventLink | Event Industry Professional Network";
    
    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Learn how EventLink connects freelance event professionals with corporate event opportunities. Step-by-step guide for both freelancers and recruiters in the events industry.');
    } else {
      // Create meta description if it doesn't exist
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = 'Learn how EventLink connects freelance event professionals with corporate event opportunities. Step-by-step guide for both freelancers and recruiters in the events industry.';
      document.head.appendChild(meta);
    }

    // Cleanup: Reset to default title when component unmounts
    return () => {
      document.title = "EventLink - Event Industry Professional Network";
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', 'Connecting technical professionals with event opportunities in the corporate events sector.');
      }
    };
  }, []);

  const handleFreelancerCTA = () => {
    if (user) {
      setLocation('/dashboard');
    } else {
      setLocation('/auth?tab=signup');
    }
  };

  const handleRecruiterCTA = () => {
    if (user && user.role === 'recruiter') {
      setLocation('/dashboard'); // Recruiters can post jobs from dashboard
    } else if (user) {
      setLocation('/dashboard');
    } else {
      setLocation('/auth?tab=signup');
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        {/* Header Section */}
        <div className="text-center max-w-4xl mx-auto mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-orange-600 bg-clip-text text-transparent">
            How Does It Work?
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed">
            EventLink connects event professionals with opportunities in the corporate events industry. 
            Whether you're a freelancer looking for work or a recruiter seeking skilled professionals, 
            we make the process simple and efficient.
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-12 max-w-7xl mx-auto">
          
          {/* For Freelancers Section */}
          <div className="space-y-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserPlus className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold mb-4 text-foreground">For Freelancers</h2>
              <p className="text-muted-foreground">Build your career in the events industry</p>
            </div>

            <div className="space-y-6">
              <Card className="border-l-4 border-l-blue-500 shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">Create Your Profile</h3>
                      <p className="text-muted-foreground">
                        Register for free, upload your CV, add photos of your work, and highlight your skills. 
                        Showcase your expertise in AV, event management, technical production, or other event specialties.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-blue-500 shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <BriefcaseIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">Get Matched with Jobs</h3>
                      <p className="text-muted-foreground">
                        Recruiters post opportunities and you can apply directly. Browse corporate events, 
                        conferences, exhibitions, and other exciting projects that match your skills.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-blue-500 shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">Communicate Easily</h3>
                      <p className="text-muted-foreground">
                        Use our internal messaging system to stay connected with recruiters. 
                        Discuss project details, negotiate terms, and confirm bookings all in one place.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-blue-500 shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Star className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">Grow Your Reputation</h3>
                      <p className="text-muted-foreground">
                        Get rated by recruiters and showcase your reliability and expertise. 
                        Build a strong professional reputation that opens doors to better opportunities.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="text-center pt-6">
              <Button 
                onClick={handleFreelancerCTA}
                size="lg" 
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-8 py-3 text-lg font-semibold"
                data-testid="button-create-profile"
              >
                Create Your Profile
              </Button>
            </div>
          </div>

          {/* For Recruiters Section */}
          <div className="space-y-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold mb-4 text-foreground">For Recruiters</h2>
              <p className="text-muted-foreground">Find the perfect event professionals</p>
            </div>

            <div className="space-y-6">
              <Card className="border-l-4 border-l-orange-500 shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <BriefcaseIcon className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">Post Your Job</h3>
                      <p className="text-muted-foreground">
                        Share event roles quickly and for free. Detail your requirements, location, 
                        budget, and timeline to attract the right candidates for your corporate events.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-orange-500 shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Users className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">Browse Freelancer Profiles</h3>
                      <p className="text-muted-foreground">
                        Discover qualified AV techs, event crew, and specialists with ease. 
                        Filter by location, skills, experience, and availability to find your ideal team.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-orange-500 shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Phone className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">Connect & Hire</h3>
                      <p className="text-muted-foreground">
                        Review applications, message candidates directly, and confirm bookings. 
                        Streamline your hiring process with our integrated communication tools.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-orange-500 shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Award className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">Build Your Trusted Crew</h3>
                      <p className="text-muted-foreground">
                        Rate freelancers and re-hire the best professionals for future projects. 
                        Create a reliable network of event specialists you can count on.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="text-center pt-6">
              <Button 
                onClick={handleRecruiterCTA}
                size="lg" 
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-8 py-3 text-lg font-semibold"
                data-testid="button-post-job"
              >
                Post a Job
              </Button>
            </div>
          </div>
        </div>

        {/* Bottom CTA Section */}
        <div className="text-center mt-16 pt-12 border-t border-border">
          <h3 className="text-2xl font-bold mb-4">Ready to Get Started?</h3>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of event professionals who are already using EventLink to grow their careers and find the perfect team members.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
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
              Join as Recruiter
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}