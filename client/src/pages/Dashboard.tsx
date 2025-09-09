import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { apiRequest } from '@/lib/queryClient';
import { Layout } from '@/components/Layout';
import SimplifiedFreelancerDashboard from '@/components/SimplifiedFreelancerDashboard';
import SimplifiedRecruiterDashboard from '@/components/SimplifiedRecruiterDashboard';
import { Skeleton } from '@/components/ui/skeleton';

interface Profile {
  id: string;
  role: 'freelancer' | 'recruiter' | 'admin';
  email: string;
}

export default function Dashboard() {
  const { user, loading: authLoading } = useOptimizedAuth();
  const [, setLocation] = useLocation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return; // Wait for auth to load
    
    // Give a bit more time for auth state to settle after redirect
    const checkAuth = setTimeout(() => {
      if (!user) {
        // Double-check localStorage before redirecting
        const storedUser = localStorage.getItem('user');
        if (!storedUser) {
          console.log('Dashboard: No user found, redirecting to auth');
          setLocation('/auth');
          return;
        }
        console.log('Dashboard: User in localStorage but not in state, waiting...');
        return;
      }
      
      // Additional validation: check if user object has required fields
      if (!user.id || !user.email || !user.role) {
        console.log('Dashboard: Invalid user object, redirecting to auth');
        setLocation('/auth');
        return;
      }
      
      fetchProfile();
    }, 200); // Small delay to let auth state settle
    
    return () => clearTimeout(checkAuth);
  }, [user, authLoading, setLocation]);

  const fetchProfile = async () => {
    try {
      if (user) {
        console.log('Dashboard fetchProfile - user data:', { id: user.id, role: user.role, email: user.email });
        // Since we have user data with role, we can set the profile directly
        const profileData = {
          id: user.id.toString(),
          role: user.role,
          email: user.email
        };
        console.log('Dashboard fetchProfile - setting profile data:', profileData);
        setProfile(profileData);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="space-y-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </Layout>
    );
  }

  // If user is not authenticated, redirect will happen in useEffect
  if (!user) {
    return null;
  }

  if (!profile) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Profile not found</h1>
            <p className="text-muted-foreground">Unable to load your profile. Please try again.</p>
          </div>
        </div>
      </Layout>
    );
  }

  console.log('Dashboard render - profile data:', profile);
  console.log('Dashboard render - showing:', profile.role === 'freelancer' ? 'FreelancerDashboard' : 'RecruiterDashboard');

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {profile.role === 'freelancer' ? (
          <SimplifiedFreelancerDashboard />
        ) : (
          <SimplifiedRecruiterDashboard />
        )}
      </div>
    </Layout>
  );
}