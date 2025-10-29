import { Link, useLocation } from "wouter";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { EventLinkLogo } from "@/components/Logo";
import { useToast } from "@/hooks/use-toast";

export const Footer = () => {
  const [, setLocation] = useLocation();
  const { user } = useOptimizedAuth();
  const { toast } = useToast();

  return (
    <footer className="bg-card border-t mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <EventLinkLogo size={40} />
              <span className="font-semibold text-lg">EventLink</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Connecting technical professionals with event opportunities in the corporate events sector.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-3">For Freelancers</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/jobs" className="hover:text-foreground" data-testid="footer-link-browse-jobs">Browse Jobs</Link></li>
              <li>
                <button 
                  onClick={() => {
                    if (user) {
                      setLocation('/dashboard');
                    } else {
                      setLocation('/auth');
                    }
                  }}
                  className="hover:text-foreground"
                  data-testid="footer-button-create-profile"
                >
                  Create Profile
                </button>
              </li>
              <li><Link to="/how-it-works" className="hover:text-foreground" data-testid="footer-link-how-it-works">How Does It Work</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-3">For Companies</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/freelancers" className="hover:text-foreground" data-testid="footer-link-find-crew">Find Crew</Link></li>
              <li>
                <button 
                  onClick={() => {
                    if (!user) {
                      // Not logged in - redirect to sign in
                      setLocation('/auth');
                    } else if (user.role === 'freelancer') {
                      // Freelancer - show error message
                      toast({
                        title: 'Access Denied',
                        description: 'Only recruiters can post jobs. Please sign in with a recruiter account.',
                        variant: 'destructive',
                      });
                    } else if (user.role === 'recruiter') {
                      // Recruiter - redirect to post job form
                      setLocation('/dashboard?tab=jobs&action=post');
                    }
                  }}
                  className="hover:text-foreground"
                  data-testid="footer-button-post-job"
                >
                  Post a Job
                </button>
              </li>
              <li><Link to="/auth?tab=signup" className="hover:text-foreground" data-testid="footer-link-company-signup">Get Started</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-3">Support</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/contact-us" className="hover:text-foreground" data-testid="footer-link-contact">Contact Us</Link></li>
              <li><Link to="/faq" className="hover:text-foreground" data-testid="footer-link-faq">FAQ</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t mt-8 pt-6 text-center text-sm text-muted-foreground">
          <p>&copy; 2024 Kite. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};