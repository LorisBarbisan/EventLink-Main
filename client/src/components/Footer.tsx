import { EventLinkLogo } from "@/components/Logo";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { CREW_LANDING_PAGES } from "@shared/crewLandingPages";

interface FooterProps {
  dark?: boolean;
}

export const Footer = ({ dark = false }: FooterProps) => {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const bg = dark ? "#192743" : "#F4F2EE";
  const brandText = dark ? "text-sm font-semibold text-white" : "text-sm font-semibold";
  const descText = dark ? "text-xs text-white/60" : "text-xs text-muted-foreground";
  const headingText = dark
    ? "mb-1 text-xs font-semibold uppercase tracking-wide text-white/50"
    : "mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground";
  const listClass = dark
    ? "space-y-1 text-xs text-white/60"
    : "space-y-1 text-xs text-muted-foreground";
  const linkHover = dark ? "hover:text-white" : "hover:text-foreground";
  const borderClass = dark ? "border-t border-white/10" : "border-t";
  const bottomBarClass = dark
    ? "border-t border-white/10 py-3 text-center text-xs text-white/50"
    : "border-t bg-white py-3 text-center text-xs text-muted-foreground";

  return (
    <footer className={`mt-auto ${borderClass}`}>
      <div style={{ backgroundColor: bg }}>
        <div className="container mx-auto px-4 py-4">
          <div className="grid grid-cols-1 gap-4 text-center md:grid-cols-4 md:text-left">
            <div className="flex flex-col items-center md:items-start">
              <div className="mb-2 flex items-center justify-center space-x-2 md:justify-start">
                <EventLinkLogo size={28} />
                <span className={brandText}>EventLink</span>
              </div>
              <p className={descText}>Showcase Talent - Share Opportunities - Build Connections</p>
            </div>

            <div>
              <h4 className={headingText}>For Freelancers</h4>
              <ul className={listClass}>
                <li>
                  <Link to="/jobs" className={linkHover} data-testid="footer-link-browse-jobs">
                    Browse Jobs
                  </Link>
                </li>
                <li>
                  <button
                    onClick={() => setLocation(user ? "/dashboard" : "/auth")}
                    className={linkHover}
                    data-testid="footer-button-create-profile"
                  >
                    Create Profile
                  </button>
                </li>
                <li>
                  <Link
                    to="/how-it-works"
                    className={linkHover}
                    data-testid="footer-link-how-it-works"
                  >
                    How Does It Work
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className={headingText}>For Companies</h4>
              <ul className={listClass}>
                <li>
                  <Link to="/freelancers" className={linkHover} data-testid="footer-link-find-crew">
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
                          description:
                            "Only employers can post jobs. Please sign in with an employer account.",
                          variant: "destructive",
                        });
                      } else if (user.role === "recruiter") {
                        setLocation("/dashboard?tab=jobs&action=post");
                      }
                    }}
                    className={linkHover}
                    data-testid="footer-button-post-job"
                  >
                    Post a Job
                  </button>
                </li>
                <li>
                  <Link
                    to="/auth?tab=signup"
                    className={linkHover}
                    data-testid="footer-link-company-signup"
                  >
                    Get Started
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className={headingText}>Support</h4>
              <ul className={listClass}>
                <li>
                  <Link to="/contact-us" className={linkHover} data-testid="footer-link-contact">
                    Contact Us
                  </Link>
                </li>
                <li>
                  <Link to="/faq" className={linkHover} data-testid="footer-link-faq">
                    FAQ
                  </Link>
                </li>
                <li>
                  <Link to="/about" className={linkHover} data-testid="footer-link-about">
                    About
                  </Link>
                </li>
                <li>
                  <a
                    href="/terms-of-use.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkHover}
                  >
                    Terms &amp; Conditions
                  </a>
                </li>
                <li>
                  <Link to="/privacy" className={linkHover} data-testid="footer-link-privacy">
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Browse freelance crew — subtle inline internal links to the landing pages */}
          <div className="mt-3 border-t pt-3">
            <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[11px] leading-relaxed text-muted-foreground/70">
              <span className="font-medium">Browse crew:</span>
              {CREW_LANDING_PAGES.map((p, i) => (
                <span key={p.slug} className="flex items-center gap-x-2">
                  <Link
                    to={p.path}
                    className="hover:text-foreground hover:underline"
                    data-testid={`footer-link-crew-${p.slug}`}
                  >
                    {p.role.heading} in {p.city.name}
                  </Link>
                  {i < CREW_LANDING_PAGES.length - 1 && <span aria-hidden="true">·</span>}
                </span>
              ))}
            </p>
          </div>
        </div>
      </div>
      <div className={bottomBarClass} style={{ backgroundColor: dark ? "#192743" : undefined }}>
        <p>&copy; 2026 EventLink Ltd. All rights reserved.</p>
      </div>
    </footer>
  );
};
