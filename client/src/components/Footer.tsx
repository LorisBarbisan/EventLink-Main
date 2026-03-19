import { EventLinkLogo } from "@/components/Logo";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";

export const Footer = () => {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  return (
    <footer className="mt-auto border-t bg-card">
      <div className="container mx-auto px-4 py-4">
        <div className="grid grid-cols-1 gap-4 text-center md:grid-cols-4 md:text-left">
          <div className="flex flex-col items-center md:items-start">
            <div className="mb-2 flex items-center justify-center space-x-2 md:justify-start">
              <EventLinkLogo size={28} />
              <span className="text-sm font-semibold">EventLink</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Connecting technical professionals with event opportunities across the events industry.
            </p>
          </div>

          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">For Freelancers</h4>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>
                <Link to="/jobs" className="hover:text-foreground" data-testid="footer-link-browse-jobs">
                  Browse Jobs
                </Link>
              </li>
              <li>
                <button
                  onClick={() => setLocation(user ? "/dashboard" : "/auth")}
                  className="hover:text-foreground"
                  data-testid="footer-button-create-profile"
                >
                  Create Profile
                </button>
              </li>
              <li>
                <Link to="/how-it-works" className="hover:text-foreground" data-testid="footer-link-how-it-works">
                  How Does It Work
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">For Companies</h4>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>
                <Link to="/freelancers" className="hover:text-foreground" data-testid="footer-link-find-crew">
                  Find Crew
                </Link>
              </li>
              <li>
                <button
                  onClick={() => {
                    if (!user) {
                      setLocation("/auth");
                    } else if (user.role === "freelancer") {
                      toast({
                        title: "Access Denied",
                        description: "Only employers can post jobs. Please sign in with an employer account.",
                        variant: "destructive",
                      });
                    } else if (user.role === "recruiter") {
                      setLocation("/dashboard?tab=jobs&action=post");
                    }
                  }}
                  className="hover:text-foreground"
                  data-testid="footer-button-post-job"
                >
                  Post a Job
                </button>
              </li>
              <li>
                <Link to="/auth?tab=signup" className="hover:text-foreground" data-testid="footer-link-company-signup">
                  Get Started
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Support</h4>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>
                <Link to="/contact-us" className="hover:text-foreground" data-testid="footer-link-contact">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link to="/faq" className="hover:text-foreground" data-testid="footer-link-faq">
                  FAQ
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-foreground" data-testid="footer-link-about">
                  About
                </Link>
              </li>
              <li>
                <a
                  href="/terms-of-use.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground"
                >
                  Terms &amp; Conditions
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-4 border-t pt-3 text-center text-xs text-muted-foreground">
          <p>&copy; 2026 Kite. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};
