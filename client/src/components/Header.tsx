import { InviteClientsDialog } from "@/components/InviteClientsDialog";
import { InsuranceOffersDialog } from "@/components/InsuranceOffersDialog";
import { EventLinkLogo } from "@/components/Logo";
import { MobileNavigation } from "@/components/MobileNavigation";
import { NotificationSystem } from "@/components/notifications/NotificationSystem";
import { SearchBar } from "@/components/SearchBar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { UserMenu } from "@/components/UserMenu";
import { useAuth } from "@/hooks/useAuth";
import { useInsuranceAccess } from "@/hooks/useIsUkFreelancer";
import { Menu, MessageSquare, Plus, ShieldCheck, Star } from "lucide-react";
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
  const [showInsuranceDialog, setShowInsuranceDialog] = useState(false);
  const insuranceAccess = useInsuranceAccess();

  return (
    <header className="border-b shadow-sm" style={{ backgroundColor: "#F4F2EE" }}>
      <div className="container mx-auto px-3 py-3 sm:px-4 lg:py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link
            to="/"
            className="flex min-w-fit flex-shrink-0 items-center space-x-3"
            data-testid="link-logo"
          >
            <EventLinkLogo size={48} />
            <span className="hidden text-2xl font-bold text-foreground md:inline">EventLink</span>
          </Link>

          {/* Insurance offers — sits on the left, mirroring Build My Reputation
              on the right. UK freelancers get offers; freelancers without a
              profile get a prompt to create one. */}
          {insuranceAccess !== "hidden" && (
            <Button
              onClick={() => setShowInsuranceDialog(true)}
              className="ml-2 hidden flex-shrink-0 border-0 bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md transition-all hover:from-purple-600 hover:to-pink-600 lg:flex"
              data-testid="button-insurance-offers"
              title="Insurance offers for UK-based freelancers"
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              Insurance Offers (UK)
            </Button>
          )}

          {/* Navigation */}
          <nav className="hidden flex-1 items-center justify-center space-x-3 sm:flex lg:space-x-4 xl:space-x-6">
            <Link
              to="/jobs"
              className="whitespace-nowrap text-sm text-muted-foreground transition-colors hover:text-foreground lg:text-base"
              data-testid="link-jobs"
            >
              Find Jobs
            </Link>
            <Link
              to="/freelancers"
              className="whitespace-nowrap text-sm text-muted-foreground transition-colors hover:text-foreground lg:text-base"
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
              className="text-sm text-muted-foreground transition-colors hover:text-foreground lg:text-base"
              data-testid="button-dashboard"
            >
              Dashboard
            </button>
            <button
              onClick={onFeedbackClick}
              className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground lg:text-base"
              data-testid="button-feedback"
            >
              <MessageSquare className="h-4 w-4" />
              Feedback
            </button>
          </nav>

          {/* Actions */}
          <div className="flex flex-shrink-0 items-center justify-end space-x-1 sm:space-x-3">
            {!isHomePage && <SearchBar />}

            {user?.role === "recruiter" && (
              <Button
                onClick={() => setLocation("/dashboard?tab=jobs&action=post")}
                className="bg-gradient-primary hover:bg-gradient-primary/90 hidden text-white lg:flex"
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
                className="hidden transform border-0 bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md transition-all duration-300 hover:scale-[1.02] hover:from-amber-600 hover:to-orange-700 lg:flex"
                data-testid="button-invite-clients"
              >
                <Star className="mr-2 h-4 w-4 fill-white" />
                Build My Reputation
              </Button>
            )}

            {user ? (
              <div className="flex items-center space-x-1 sm:space-x-2">
                <NotificationSystem userId={user.id} />
                <UserMenu />
              </div>
            ) : (
              <div className="hidden items-center space-x-2 sm:flex lg:space-x-3">
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
                <Button variant="ghost" size="icon" className="sm:hidden">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <MobileNavigation
                  onFeedbackClick={onFeedbackClick}
                  onInviteClick={() => setShowInviteDialog(true)}
                  insuranceAccess={insuranceAccess}
                  onInsuranceClick={() => setShowInsuranceDialog(true)}
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
      <InsuranceOffersDialog
        open={showInsuranceDialog}
        onOpenChange={setShowInsuranceDialog}
        mode={insuranceAccess === "available" ? "offers" : "needs-profile"}
      />
    </header>
  );
};
