import { EventLinkLogo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { MessageSquare, Plus } from "lucide-react";
import { Link, useLocation } from "wouter";

interface MobileNavigationProps {
  onFeedbackClick: () => void;
}

export const MobileNavigation = ({ onFeedbackClick }: MobileNavigationProps) => {
  const [, setLocation] = useLocation();
  const { user, signOut } = useAuth();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center space-x-3 pb-6 border-b">
        <EventLinkLogo size={40} />
        <span className="text-xl font-bold">EventLink</span>
      </div>

      {/* User info if logged in */}
      {user && (
        <div className="py-4 border-b">
          <p className="font-medium">{user.email}</p>
          <p className="text-sm text-muted-foreground capitalize">{user.role}</p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex flex-col space-y-4 mt-8">
        <Link
          to="/jobs"
          className="text-foreground hover:text-primary transition-colors py-2 px-4 rounded-md hover:bg-muted"
          data-testid="mobile-link-jobs"
        >
          Find Jobs
        </Link>
        <Link
          to="/freelancers"
          className="text-foreground hover:text-primary transition-colors py-2 px-4 rounded-md hover:bg-muted"
          data-testid="mobile-link-freelancers"
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
          className="text-left text-foreground hover:text-primary transition-colors py-2 px-4 rounded-md hover:bg-muted"
          data-testid="mobile-button-dashboard"
        >
          Dashboard
        </button>
        <button
          onClick={onFeedbackClick}
          className="text-left text-foreground hover:text-primary transition-colors py-2 px-4 rounded-md hover:bg-muted flex items-center gap-2"
          data-testid="mobile-button-feedback"
        >
          <MessageSquare className="w-4 h-4" />
          Feedback
        </button>

        {/* Post New Job button - only for recruiters */}
        {user?.role === "recruiter" && (
          <button
            onClick={() => setLocation("/dashboard?tab=jobs&action=post")}
            className="text-left bg-gradient-primary text-white py-3 px-4 rounded-md hover:bg-gradient-primary/90 transition-colors flex items-center gap-2 font-medium"
            data-testid="mobile-button-post-job"
          >
            <Plus className="w-4 h-4" />
            Post New Job
          </button>
        )}

        {user ? (
          <>
            <Link
              to="/profile"
              className="text-foreground hover:text-primary transition-colors py-2 px-4 rounded-md hover:bg-muted"
              data-testid="mobile-link-profile"
            >
              Profile
            </Link>
            <Link
              to="/settings"
              className="text-foreground hover:text-primary transition-colors py-2 px-4 rounded-md hover:bg-muted"
              data-testid="mobile-link-settings"
            >
              Settings
            </Link>
            <Link
              to="/notification-settings"
              className="text-foreground hover:text-primary transition-colors py-2 px-4 rounded-md hover:bg-muted"
              data-testid="mobile-link-notification-settings"
            >
              Notification Settings
            </Link>
            {user.role === "admin" && (
              <Link
                to="/admin"
                className="text-foreground hover:text-primary transition-colors py-2 px-4 rounded-md hover:bg-muted"
                data-testid="mobile-link-admin"
              >
                Admin Dashboard
              </Link>
            )}
            <button
              onClick={signOut}
              className="text-left text-foreground hover:text-primary transition-colors py-2 px-4 rounded-md hover:bg-muted mt-4"
              data-testid="mobile-button-signout"
            >
              Sign Out
            </button>
          </>
        ) : (
          <>
            <Link
              to="/auth"
              className="text-foreground hover:text-primary transition-colors py-2 px-4 rounded-md hover:bg-muted"
              data-testid="mobile-link-signin"
            >
              Sign In
            </Link>
            <Link
              to="/auth?tab=signup"
              className="bg-primary text-white py-2 px-4 rounded-md hover:bg-primary-hover transition-colors"
              data-testid="mobile-link-signup"
            >
              Get Started
            </Link>
          </>
        )}
      </nav>
    </div>
  );
};
