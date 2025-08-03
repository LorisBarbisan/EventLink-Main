import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { Layout } from '@/components/Layout';
import { FreelancerDashboardTabs } from '@/components/FreelancerDashboardTabs';
import { RecruiterDashboard } from '@/components/RecruiterDashboard';
import { Skeleton } from '@/components/ui/skeleton';

interface Profile {
  id: string;
  role: 'freelancer' | 'recruiter';
  email: string;
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return; // Wait for auth to load
    
    if (!user) {
      // Redirect to auth page if not logged in
      setLocation('/auth');
      return;
    }
    
    fetchProfile();
  }, [user, authLoading, setLocation]);

  const fetchProfile = async () => {
    try {
      if (user) {
        // Since we have user data with role, we can set the profile directly
        setProfile({
          id: user.id.toString(),
          role: user.role,
          email: user.email
        });
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

  return (
    <Layout>
      {profile.role === 'freelancer' ? (
        <FreelancerDashboardTabs profile={profile} />
      ) : (
        <RecruiterDashboard profile={profile} />
      )}
    </Layout>
  );
}