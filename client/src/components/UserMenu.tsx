import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, LogOut, Settings, UserCircle, Star, Bell } from "lucide-react";
import { useLocation } from "wouter";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { useProfile } from "@/hooks/useProfile";

export const UserMenu = () => {
  const [, setLocation] = useLocation();
  const { user, signOut } = useOptimizedAuth();
  
  if (!user) return null;

  // Get profile data based on user role
  const userType = user?.role === 'freelancer' ? 'freelancer' : 'recruiter';
  const { profile } = useProfile({ userType, userId: user?.id || 0 });

  // Get display name based on user account data
  const getDisplayName = () => {
    if (!user) return '';
    
    // For admin users, always use first_name + last_name from user data
    if (user.role === 'admin') {
      const firstName = user.first_name ?? '';
      const lastName = user.last_name ?? '';
      const fullName = `${firstName} ${lastName}`.trim();
      return fullName || user.email.split('@')[0];
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full" data-testid="button-user-menu">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{getInitials()}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <div className="flex items-center justify-start gap-2 p-2">
          <div className="flex flex-col space-y-1 leading-none">
            <p className="font-medium">{getDisplayName()}</p>
            <p className="w-[200px] truncate text-sm text-muted-foreground">
              {user.email}
            </p>
          </div>
        </div>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={() => setLocation('/dashboard')} data-testid="menu-dashboard">
          <User className="mr-2 h-4 w-4" />
          Dashboard
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => setLocation('/profile')} data-testid="menu-profile">
          <UserCircle className="mr-2 h-4 w-4" />
          Profile
        </DropdownMenuItem>
        
        {user.role === 'freelancer' && (
          <DropdownMenuItem onClick={() => setLocation('/ratings')} data-testid="menu-ratings">
            <Star className="mr-2 h-4 w-4" />
            My Ratings
          </DropdownMenuItem>
        )}
        
        <DropdownMenuItem onClick={() => setLocation('/notification-settings')} data-testid="menu-notification-settings">
          <Bell className="mr-2 h-4 w-4" />
          Notification Settings
        </DropdownMenuItem>
        
        {user.role === 'admin' && (
          <DropdownMenuItem onClick={() => setLocation('/admin')} data-testid="menu-admin">
            <Settings className="mr-2 h-4 w-4" />
            Admin Dashboard
          </DropdownMenuItem>
        )}
        
        <DropdownMenuItem onClick={() => setLocation('/settings')} data-testid="menu-settings">
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={signOut} data-testid="menu-signout">
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};