import { Link, useLocation } from "wouter";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { EventLinkLogo } from "@/components/Logo";

export const Footer = () => {
  const [, setLocation] = useLocation();
  const { user } = useOptimizedAuth();

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
                    if (user) {
                      setLocation('/dashboard');
                    } else {
                      setLocation('/auth');
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
              <li><a href="mailto:support@eventlink.com" className="hover:text-foreground" data-testid="footer-link-contact">Contact Us</a></li>
              <li><Link to="/jobs" className="hover:text-foreground" data-testid="footer-link-support-jobs">Browse Jobs</Link></li>
              <li><Link to="/freelancers" className="hover:text-foreground" data-testid="footer-link-find-professionals">Find Professionals</Link></li>
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