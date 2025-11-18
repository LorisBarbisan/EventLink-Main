import { Layout } from "@/components/Layout";
import SimplifiedFreelancerDashboard from "@/components/SimplifiedFreelancerDashboard";
import SimplifiedRecruiterDashboard from "@/components/SimplifiedRecruiterDashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";

interface Profile {
  id: number;
  role: "freelancer" | "recruiter" | "admin";
  email: string;
}

export default function Dashboard() {
  const { user, loading: authLoading } = useOptimizedAuth();
  const [, setLocation] = useLocation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    try {
      if (user) {
        console.log("Dashboard fetchProfile - user data:", {
          id: user.id,
          role: user.role,
          email: user.email,
        });

        // Validate that user has a role
        if (!user.role) {
          console.error("⚠️ User object missing role property:", user);
        }

        // Since we have user data with role, we can set the profile directly
        // Default to freelancer if role is missing to prevent wrong dashboard
        const profileData = {
          id: user.id,
          role: (user.role || "freelancer") as "freelancer" | "recruiter" | "admin",
          email: user.email,
        };
        console.log("Dashboard fetchProfile - setting profile data:", profileData);
        setProfile(profileData);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return; // Wait for auth to load

    if (!user) {
      // Only redirect if auth is fully loaded and still no user
      const storedUser = localStorage.getItem("user");
      if (!storedUser) {
        console.log("Dashboard: No user found, redirecting to auth");
        setLocation("/auth");
      }
      return;
    }

    // User exists, fetch profile
    fetchProfile();
  }, [user, authLoading, setLocation, fetchProfile]);

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

  console.log("Dashboard render - profile data:", profile);
  console.log("Dashboard render - user data:", user);
  console.log("Dashboard render - profile.role:", profile.role);
  console.log(
    "Dashboard render - showing:",
    profile.role === "freelancer" ? "FreelancerDashboard" : "RecruiterDashboard"
  );

  // Determine which dashboard to show based on role
  // Default to freelancer if role is undefined/null to prevent wrong dashboard
  const showFreelancerDashboard = profile.role === "freelancer";
  const showRecruiterDashboard = profile.role === "recruiter" || profile.role === "admin";

  if (!showFreelancerDashboard && !showRecruiterDashboard) {
    console.error("⚠️ Unknown user role:", profile.role, "- Defaulting to FreelancerDashboard");
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {showFreelancerDashboard ? (
          <SimplifiedFreelancerDashboard />
        ) : showRecruiterDashboard ? (
          <SimplifiedRecruiterDashboard />
        ) : (
          // Fallback: if role is somehow undefined/null, default to freelancer
          <SimplifiedFreelancerDashboard />
        )}
      </div>
    </Layout>
  );
}
