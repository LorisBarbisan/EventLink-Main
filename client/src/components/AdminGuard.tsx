import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading && !user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to access the admin dashboard.',
        variant: 'destructive',
      });
      setLocation('/auth');
    } else if (!isLoading && user && user.role !== 'admin') {
      toast({
        title: 'Access Denied',
        description: 'Admin privileges are required to access this page.',
        variant: 'destructive',
      });
      setLocation('/dashboard');
    }
  }, [user, isLoading, setLocation, toast]);

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

  // Don't render admin content for non-admin users
  if (!user || user.role !== 'admin') {
    return null;
  }

  // Render admin dashboard for authenticated admin users
  return <>{children}</>;
}