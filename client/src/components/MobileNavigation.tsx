import { EventLinkLogo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { MessageSquare, Plus, Star } from "lucide-react";
import { Link, useLocation } from "wouter";

interface MobileNavigationProps {
  onFeedbackClick: () => void;
  onInviteClick?: () => void;
}

export const MobileNavigation = ({ onFeedbackClick, onInviteClick }: MobileNavigationProps) => {
  const [, setLocation] = useLocation();
  const { user, signOut } = useAuth();

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center space-x-3 border-b pb-6">
        <EventLinkLogo size={40} />
        <span className="text-xl font-bold">EventLink</span>
      </div>

      {/* User info if logged in */}
      {user && (
        <div className="border-b py-4">
          <p className="font-medium">{user.email}</p>
          <p className="text-sm capitalize text-muted-foreground">{user.role}</p>
        </div>
      )}

      {/* Navigation */}
      <nav className="mt-8 flex flex-col space-y-4">
        <Link
          to="/jobs"
          className="rounded-md px-4 py-2 text-foreground transition-colors hover:bg-muted hover:text-primary"
          data-testid="mobile-link-jobs"
        >
          Find Jobs
        </Link>
        <Link
          to="/freelancers"
          className="rounded-md px-4 py-2 text-foreground transition-colors hover:bg-muted hover:text-primary"
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
          className="rounded-md px-4 py-2 text-left text-foreground transition-colors hover:bg-muted hover:text-primary"
          data-testid="mobile-button-dashboard"
        >
          Dashboard
        </button>
        <button
          onClick={onFeedbackClick}
          className="flex items-center gap-2 rounded-md px-4 py-2 text-left text-foreground transition-colors hover:bg-muted hover:text-primary"
          data-testid="mobile-button-feedback"
        >
          <MessageSquare className="h-4 w-4" />
          Feedback
        </button>

        {/* Post New Job button - only for recruiters */}
        {user?.role === "recruiter" && (
          <button
            onClick={() => setLocation("/dashboard?tab=jobs&action=post")}
            className="bg-gradient-primary hover:bg-gradient-primary/90 flex items-center gap-2 rounded-md px-4 py-3 text-left font-medium text-white transition-colors"
            data-testid="mobile-button-post-job"
          >
            <Plus className="h-4 w-4" />
            Post New Job
          </button>
        )}

        {/* Invite Clients button - only for freelancers */}
        {user?.role === "freelancer" && onInviteClick && (
          <button
            onClick={onInviteClick}
            className="flex w-full items-center gap-2 rounded-md bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-3 text-left font-medium text-white shadow-sm transition-colors hover:from-amber-600 hover:to-orange-700"
            data-testid="mobile-button-invite-clients"
          >
            <Star className="h-4 w-4 flex-shrink-0 fill-white" />
            Invite Clients to Rate You
          </button>
        )}

        {user ? (
          <>
            <Link
              to="/profile"
              className="rounded-md px-4 py-2 text-foreground transition-colors hover:bg-muted hover:text-primary"
              data-testid="mobile-link-profile"
            >
              Profile
            </Link>
            <Link
              to="/settings"
              className="rounded-md px-4 py-2 text-foreground transition-colors hover:bg-muted hover:text-primary"
              data-testid="mobile-link-settings"
            >
              Settings
            </Link>
            <Link
              to="/notification-settings"
              className="rounded-md px-4 py-2 text-foreground transition-colors hover:bg-muted hover:text-primary"
              data-testid="mobile-link-notification-settings"
            >
              Notification Settings
            </Link>
            {user.role === "admin" && (
              <Link
                to="/admin"
                className="rounded-md px-4 py-2 text-foreground transition-colors hover:bg-muted hover:text-primary"
                data-testid="mobile-link-admin"
              >
                Admin Dashboard
              </Link>
            )}
            <button
              onClick={signOut}
              className="mt-4 rounded-md px-4 py-2 text-left text-foreground transition-colors hover:bg-muted hover:text-primary"
              data-testid="mobile-button-signout"
            >
              Sign Out
            </button>
          </>
        ) : (
          <>
            <Link
              to="/auth"
              className="rounded-md px-4 py-2 text-foreground transition-colors hover:bg-muted hover:text-primary"
              data-testid="mobile-link-signin"
            >
              Sign In
            </Link>
            <Link
              to="/auth?tab=signup"
              className="hover:bg-primary-hover rounded-md bg-primary px-4 py-2 text-white transition-colors"
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
