import { EventLinkLogo } from "@/components/Logo";
import { MobileNavigation } from "@/components/MobileNavigation";
import { NotificationSystem } from "@/components/notifications/NotificationSystem";
import { SearchBar } from "@/components/SearchBar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { UserMenu } from "@/components/UserMenu";
import { useAuth } from "@/hooks/useAuth";
import { Menu, MessageSquare, Plus } from "lucide-react";
import { Link, useLocation } from "wouter";

interface HeaderProps {
  onFeedbackClick: () => void;
}

export const Header = ({ onFeedbackClick }: HeaderProps) => {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const isHomePage = location === "/";

  return (
    <header className="bg-card border-b shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3" data-testid="link-logo">
            <EventLinkLogo size={48} />
            <span className="text-2xl font-bold text-foreground">EventLink</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link
              to="/jobs"
              className="text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-jobs"
            >
              Find Jobs
            </Link>
            <Link
              to="/freelancers"
              className="text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-freelancers"
            >
              Find Crew
            </Link>
            <button
              onClick={() => {
                if (user) {
                  setLocation("/dashboard");
                } else {
                  setLocation("/auth");
                }
              }}
              className="text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-dashboard"
            >
              Dashboard
            </button>
            <button
              onClick={onFeedbackClick}
              className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              data-testid="button-feedback"
            >
              <MessageSquare className="w-4 h-4" />
              Feedback
            </button>
          </nav>

          {/* Actions */}
          <div className="flex items-center space-x-3">
            {!isHomePage && <SearchBar />}

            {/* Post New Job button - only for recruiters */}
            {user?.role === "recruiter" && (
              <Button
                onClick={() => setLocation("/dashboard?tab=jobs&action=post")}
                className="hidden md:flex bg-gradient-primary hover:bg-gradient-primary/90 text-white"
                data-testid="button-post-job-header"
              >
                <Plus className="w-4 h-4 mr-2" />
                Post New Job
              </Button>
            )}

            {user ? (
              <div className="flex items-center space-x-2">
                <NotificationSystem userId={user.id} />
                <UserMenu />
              </div>
            ) : (
              <div className="hidden md:flex items-center space-x-3">
                <Link to="/auth">
                  <Button variant="ghost" data-testid="button-signin">
                    Sign In
                  </Button>
                </Link>
                <Link to="/auth?tab=signup">
                  <Button data-testid="button-get-started">Get Started</Button>
                </Link>
              </div>
            )}

            {/* Mobile menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <MobileNavigation onFeedbackClick={onFeedbackClick} />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
};
