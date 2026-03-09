import { InviteClientsDialog } from "@/components/InviteClientsDialog";
import { EventLinkLogo } from "@/components/Logo";
import { MobileNavigation } from "@/components/MobileNavigation";
import { NotificationSystem } from "@/components/notifications/NotificationSystem";
import { SearchBar } from "@/components/SearchBar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { UserMenu } from "@/components/UserMenu";
import { useAuth } from "@/hooks/useAuth";
import { Menu, MessageSquare, Plus, Star } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

interface HeaderProps {
  onFeedbackClick: () => void;
}

export const Header = ({ onFeedbackClick }: HeaderProps) => {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const isHomePage = location === "/";
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  return (
    <header className="border-b bg-card shadow-sm">
      <div className="container mx-auto px-4 py-3 md:py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3" data-testid="link-logo">
            <EventLinkLogo size={48} />
            <span className="hidden text-2xl font-bold text-foreground min-[420px]:inline">
              EventLink
            </span>
          </Link>

          {/* Navigation */}
          <nav className="hidden items-center space-x-6 md:flex">
            <Link
              to="/jobs"
              className="text-muted-foreground transition-colors hover:text-foreground"
              data-testid="link-jobs"
            >
              Find Jobs
            </Link>
            <Link
              to="/freelancers"
              className="text-muted-foreground transition-colors hover:text-foreground"
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
              className="text-muted-foreground transition-colors hover:text-foreground"
              data-testid="button-dashboard"
            >
              Dashboard
            </button>
            <button
              onClick={onFeedbackClick}
              className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
              data-testid="button-feedback"
            >
              <MessageSquare className="h-4 w-4" />
              Feedback
            </button>
          </nav>

          {/* Actions */}
          <div className="flex items-center space-x-1 sm:space-x-3">
            {!isHomePage && <SearchBar />}

            {user?.role === "recruiter" && (
              <Button
                onClick={() => setLocation("/dashboard?tab=jobs&action=post")}
                className="bg-gradient-primary hover:bg-gradient-primary/90 hidden text-white md:flex"
                data-testid="button-post-job-header"
              >
                <Plus className="mr-2 h-4 w-4" />
                Post New Job
              </Button>
            )}

            {/* Invite Clients button - only for freelancers */}
            {user?.role === "freelancer" && (
              <Button
                onClick={() => setShowInviteDialog(true)}
                className="hidden transform border-0 bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md transition-all duration-300 hover:scale-[1.02] hover:from-amber-600 hover:to-orange-700 md:flex"
                data-testid="button-invite-clients"
              >
                <Star className="mr-2 h-4 w-4 fill-white" />
                Invite Clients to Rate You
              </Button>
            )}

            {user ? (
              <div className="flex items-center space-x-1 sm:space-x-2">
                <NotificationSystem userId={user.id} />
                <UserMenu />
              </div>
            ) : (
              <div className="hidden items-center space-x-3 md:flex">
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
                <MobileNavigation
                  onFeedbackClick={onFeedbackClick}
                  onInviteClick={() => setShowInviteDialog(true)}
                />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
      <InviteClientsDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        userId={user?.id || 0}
      />
    </header>
  );
};
