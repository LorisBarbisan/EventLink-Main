import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useToast } from '@/hooks/use-toast';

interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { user, loading: isLoading } = useOptimizedAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const hasToasted = useRef(false);

  // Handle authentication and authorization with proper state management
  useEffect(() => {
    // Prevent multiple toasts and redirects
    if (hasToasted.current) return;
    
    if (!isLoading && !user) {
      hasToasted.current = true;
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to access the admin dashboard.',
        variant: 'destructive',
      });
      setLocation('/auth');
    } else if (!isLoading && user && user.role !== 'admin') {
      hasToasted.current = true;
      console.log('Admin access denied for user:', user.email, 'Role:', user.role);
      toast({
        title: 'Access Denied',
        description: 'Admin privileges are required to access this page.',
        variant: 'destructive',
      });
      setLocation('/dashboard');
    } else if (!isLoading && user && user.role === 'admin') {
      console.log('Admin access granted for user:', user.email, 'Role:', user.role);
    }
  }, [user, isLoading, toast, setLocation]);

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  // Handle unauthenticated users
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-destructive mx-auto"></div>
          <p className="text-muted-foreground">Authentication required. Redirecting...</p>
        </div>
      </div>
    );
  }

  // Handle non-admin users
  if (user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-destructive mx-auto"></div>
          <p className="text-muted-foreground">Access denied. Redirecting...</p>
        </div>
      </div>
    );
  }

  // Render admin dashboard for authenticated admin users
  return <>{children}</>;
}