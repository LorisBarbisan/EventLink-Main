import { useEffect } from 'react';
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
    toast({
      title: 'Authentication Required',
      description: 'Please sign in to access the admin dashboard.',
      variant: 'destructive',
    });
    setLocation('/auth');
    return null;
  }

  // Handle non-admin users - block rendering completely and redirect immediately
  if (user.role !== 'admin') {
    console.log('Admin access denied for user:', user.email, 'Role:', user.role);
    toast({
      title: 'Access Denied',
      description: 'Admin privileges are required to access this page.',
      variant: 'destructive',
    });
    // Immediate redirect for non-admin users
    setTimeout(() => setLocation('/dashboard'), 0);
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-destructive mx-auto"></div>
          <p className="text-muted-foreground">Access denied. Redirecting...</p>
        </div>
      </div>
    );
  }

  // Debug logging for admin users
  console.log('Admin access granted for user:', user.email, 'Role:', user.role);

  // Render admin dashboard for authenticated admin users
  return <>{children}</>;
}