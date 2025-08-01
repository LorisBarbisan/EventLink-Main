import { Button } from "@/components/ui/button";
import { Search, Menu, User, LogOut } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const [location, setLocation] = useLocation();
  const { user, signOut } = useAuth();
  const isHomePage = location === '/';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">EC</span>
              </div>
              <span className="text-xl font-bold text-foreground">Event Crew</span>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center space-x-6">
              <Link to="/jobs" className="text-muted-foreground hover:text-foreground transition-colors">
                Find Jobs
              </Link>
              <Link to="/freelancers" className="text-muted-foreground hover:text-foreground transition-colors">
                Find Crew
              </Link>
              <Link to="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
                Dashboard
              </Link>
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
                  />
                </div>
              )}
              
              {user ? (
                <>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/dashboard">
                      <User className="w-4 h-4 mr-2" />
                      Dashboard
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await signOut();
                      setLocation('/');
                    }}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/auth">
                      <User className="w-4 h-4 mr-2" />
                      Sign In
                    </Link>
                  </Button>
                  
                  <Button size="sm" className="bg-primary hover:bg-primary-hover text-white" asChild>
                    <Link to="/auth">Get Started</Link>
                  </Button>
                </>
              )}

              <Button variant="outline" size="sm" className="md:hidden">
                <Menu className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="bg-card border-t mt-auto">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-6 h-6 bg-gradient-primary rounded flex items-center justify-center">
                  <span className="text-white font-bold text-sm">EC</span>
                </div>
                <span className="font-semibold">Event Crew</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Connecting technical professionals with event opportunities in the corporate events sector.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3">For Freelancers</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/jobs" className="hover:text-foreground">Browse Jobs</Link></li>
                <li><Link to="/dashboard" className="hover:text-foreground">Create Profile</Link></li>
                <li><Link to="/auth" className="hover:text-foreground">Sign Up</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3">For Companies</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/freelancers" className="hover:text-foreground">Find Crew</Link></li>
                <li><Link to="/dashboard" className="hover:text-foreground">Post a Job</Link></li>
                <li><Link to="/auth" className="hover:text-foreground">Get Started</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/" className="hover:text-foreground">Help Center</Link></li>
                <li><Link to="/" className="hover:text-foreground">Contact Us</Link></li>
                <li><Link to="/" className="hover:text-foreground">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t mt-8 pt-6 text-center text-sm text-muted-foreground">
            <p>&copy; 2024 Event Crew. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};