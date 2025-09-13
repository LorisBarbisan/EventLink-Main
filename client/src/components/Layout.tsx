import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Menu, User, LogOut, Settings, UserCircle, Star, MessageSquare } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { useProfile } from "@/hooks/useProfile";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationSystem } from "@/components/NotificationSystem";
import { FeedbackForm } from "@/components/FeedbackForm";
import e8Logo from "@assets/E8 LOGO_1756038316799.png";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
// E8 Logo component using the authentic logo image
const EventLinkLogo = ({ size = 48 }: { size?: number }) => (
  <img 
    src={e8Logo} 
    alt="E8 Logo" 
    style={{ width: size, height: size }}
    className="drop-shadow-sm"
  />
);

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const [location, setLocation] = useLocation();
  const { user, signOut } = useOptimizedAuth();
  const [showFeedback, setShowFeedback] = useState(false);
  
  // Get profile data based on user role
  const userType = user?.role === 'freelancer' ? 'freelancer' : 'recruiter';
  const { profile } = useProfile({ userType, userId: user?.id || 0 });
  
  // Temporarily disable notifications hook to debug black screen
  // useNotifications({ userId: user?.id });
  
  // Get display name based on user account data
  const getDisplayName = () => {
    if (!user) return '';
    
    console.log('Layout getDisplayName - user data:', user);
    
    // For admin users, always use first_name + last_name from user data
    if (user.role === 'admin') {
      const firstName = user.first_name ?? '';
      const lastName = user.last_name ?? '';
      console.log('Admin user - firstName:', firstName, 'lastName:', lastName);
      const fullName = `${firstName} ${lastName}`.trim();
      const result = fullName || user.email.split('@')[0];
      console.log('Admin display name result:', result);
      return result;
    }
    
    // Use user account data (what shows in Account Information)
    if (user.role === 'freelancer') {
      const firstName = user.first_name ?? '';
      const lastName = user.last_name ?? '';
      const fullName = `${firstName} ${lastName}`.trim();
      return fullName || user.email.split('@')[0];
    } else if (user.role === 'recruiter') {
      // For recruiters, we still need to check the profile for company name
      if (profile) {
        const recruiterProfile = profile as any;
        const companyName = recruiterProfile.company_name || '';
        return companyName || user.email.split('@')[0];
      }
    }
    
    // Fallback to clean email-based name
    const emailName = user.email.split('@')[0];
    return emailName.replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getInitials = () => {
    if (!user) return '';
    
    // Handle admin users first
    if (user.role === 'admin') {
      const firstName = user.first_name ?? '';
      const lastName = user.last_name ?? '';
      if (firstName && lastName) {
        return `${firstName[0]}${lastName[0]}`.toUpperCase();
      } else if (firstName) {
        return firstName[0].toUpperCase();
      }
    }
    
    // Use user account data for freelancers
    if (user.role === 'freelancer') {
      const firstName = user.first_name ?? '';
      const lastName = user.last_name ?? '';
      if (firstName && lastName) {
        return `${firstName[0]}${lastName[0]}`.toUpperCase();
      } else if (firstName) {
        return firstName[0].toUpperCase();
      }
    } else if (user.role === 'recruiter' && profile) {
      const recruiterProfile = profile as any;
      const companyName = recruiterProfile.company_name || '';
      if (companyName) {
        const words = companyName.split(' ');
        return words.length > 1 
          ? `${words[0][0]}${words[1][0]}`.toUpperCase()
          : companyName.slice(0, 2).toUpperCase();
      }
    }
    
    // Fallback to email-based initials
    const name = user.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return name.split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase();
  };
  const isHomePage = location === '/';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link 
              to="/" 
              className="flex items-center space-x-3" 
              data-testid="logo-header"
              onClick={(e) => {
                e.preventDefault();
                setLocation('/');
              }}
            >
              <EventLinkLogo size={48} />
              <span className="text-2xl font-bold text-foreground">EventLink</span>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center space-x-6">
              <Link to="/jobs" className="text-muted-foreground hover:text-foreground transition-colors">
                Find Jobs
              </Link>
              <Link to="/freelancers" className="text-muted-foreground hover:text-foreground transition-colors">
                Find Crew
              </Link>
              <button 
                onClick={() => {
                  if (user) {
                    setLocation('/dashboard');
                  } else {
                    setLocation('/auth');
                  }
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Dashboard
              </button>
              <button 
                onClick={() => setShowFeedback(true)}
                className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                data-testid="link-feedback"
              >
                <MessageSquare className="w-4 h-4" />
                Feedback
              </button>
            </nav>

            {/* Actions */}
            <div className="flex items-center space-x-3">
              {!isHomePage && (
                <div className="hidden md:flex items-center space-x-2 bg-muted rounded-lg px-3 py-2">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <input 
                    type="text" 
                    placeholder="Search jobs..." 
                    className="bg-transparent border-none outline-none text-sm w-32"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const query = e.currentTarget.value.trim();
                        if (query) {
                          setLocation(`/jobs?search=${encodeURIComponent(query)}`);
                        } else {
                          setLocation('/jobs');
                        }
                      }
                    }}
                  />
                </div>
              )}
              
              {user ? (
                <div className="flex items-center gap-3">
                  <NotificationSystem userId={user.id} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center gap-2"
                        data-testid="user-menu-trigger"
                      >
                        <Avatar className="w-6 h-6">
                          <AvatarFallback className="bg-gradient-primary text-white text-xs">
                            {getInitials()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="hidden md:inline">{getDisplayName()}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem asChild>
                      <Link to="/dashboard" className="flex items-center gap-2 w-full">
                        <UserCircle className="w-4 h-4" />
                        Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/profile" className="flex items-center gap-2 w-full">
                        <User className="w-4 h-4" />
                        My Profile
                      </Link>
                    </DropdownMenuItem>
                    {user?.role === 'freelancer' && (
                      <DropdownMenuItem asChild>
                        <Link to="/ratings" className="flex items-center gap-2 w-full">
                          <Star className="w-4 h-4" />
                          My Ratings
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild>
                      <Link to="/settings" className="flex items-center gap-2 w-full">
                        <Settings className="w-4 h-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    {(() => {
                      console.log('Admin menu check - user:', user);
                      console.log('Admin menu check - user.role:', user?.role);
                      console.log('Admin menu check - condition result:', user?.role === 'admin');
                      return user?.role === 'admin';
                    })() && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link to="/admin" className="flex items-center gap-2 w-full text-purple-600">
                            <Settings className="w-4 h-4" />
                            Admin Dashboard
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={async () => {
                        await signOut();
                        setLocation('/');
                      }}
                      className="text-red-600 focus:text-red-600"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : (
                <>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/auth">
                      <User className="w-4 h-4 mr-2" />
                      Sign In
                    </Link>
                  </Button>
                  
                  <Button size="sm" className="bg-primary hover:bg-primary-hover text-white" asChild>
                    <Link to="/auth?tab=signup">Get Started</Link>
                  </Button>
                </>
              )}

              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="md:hidden">
                    <Menu className="w-4 h-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80">
                  <nav className="flex flex-col space-y-4 mt-8">
                    <Link to="/jobs" className="text-foreground hover:text-primary transition-colors py-2 px-4 rounded-md hover:bg-muted">
                      Find Jobs
                    </Link>
                    <Link to="/freelancers" className="text-foreground hover:text-primary transition-colors py-2 px-4 rounded-md hover:bg-muted">
                      Find Crew
                    </Link>
                    <button 
                      onClick={() => {
                        if (user) {
                          setLocation('/dashboard');
                        } else {
                          setLocation('/auth');
                        }
                      }}
                      className="text-left text-foreground hover:text-primary transition-colors py-2 px-4 rounded-md hover:bg-muted"
                    >
                      Dashboard
                    </button>
                    <button 
                      onClick={() => setShowFeedback(true)}
                      className="text-left text-foreground hover:text-primary transition-colors py-2 px-4 rounded-md hover:bg-muted flex items-center gap-2"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Feedback
                    </button>
                    {!user && (
                      <>
                        <Link to="/auth" className="text-foreground hover:text-primary transition-colors py-2 px-4 rounded-md hover:bg-muted">
                          Sign In
                        </Link>
                        <Link to="/auth?tab=signup" className="bg-primary text-white py-2 px-4 rounded-md hover:bg-primary-hover transition-colors">
                          Get Started
                        </Link>
                      </>
                    )}
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>{children}</main>

      {/* Feedback Modal */}
      <FeedbackForm 
        open={showFeedback} 
        onOpenChange={setShowFeedback} 
      />

      {/* Footer */}
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
                <li><Link to="/jobs" className="hover:text-foreground">Browse Jobs</Link></li>
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
                  >
                    Create Profile
                  </button>
                </li>
                <li><Link to="/auth?tab=signup" className="hover:text-foreground">Sign Up</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3">For Companies</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/freelancers" className="hover:text-foreground">Find Crew</Link></li>
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
                  >
                    Post a Job
                  </button>
                </li>
                <li><Link to="/auth?tab=signup" className="hover:text-foreground">Get Started</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="mailto:support@eventlink.com" className="hover:text-foreground">Contact Us</a></li>
                <li><Link to="/jobs" className="hover:text-foreground">Browse Jobs</Link></li>
                <li><Link to="/freelancers" className="hover:text-foreground">Find Professionals</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t mt-8 pt-6 text-center text-sm text-muted-foreground">
            <p>&copy; 2024 E8. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};