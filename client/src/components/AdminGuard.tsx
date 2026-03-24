import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { user, loading: isLoading, updateUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const hasToasted = useRef(false);
  const [devLoggingIn, setDevLoggingIn] = useState(false);

  // In development, auto-switch to admin if the current user isn't one
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (isLoading || devLoggingIn) return;
    if (user?.role === "admin") return;

    setDevLoggingIn(true);
    fetch("/api/auth/dev-admin-login")
      .then(r => r.json())
      .then(data => {
        if (data.token && data.user) {
          localStorage.setItem("auth_token", data.token);
          localStorage.setItem("user", JSON.stringify(data.user));
          updateUser(data.user);
          console.log("🔧 [DEV] Switched to admin user:", data.user.email);
        }
      })
      .catch(() => {})
      .finally(() => setDevLoggingIn(false));
  }, [user, isLoading, devLoggingIn, updateUser]);

  // Handle authentication and authorization with proper state management
  useEffect(() => {
    if (import.meta.env.DEV) return; // dev bypass handles access
    if (hasToasted.current || isLoading) return;

    if (!user) {
      hasToasted.current = true;
      setLocation("/auth");
    } else if (user.role !== "admin") {
      hasToasted.current = true;
      console.log("Admin access denied for user:", user.email, "Role:", user.role);
      toast({
        title: "Access Denied",
        description: "Admin privileges are required to access this page.",
        variant: "destructive",
      });
      setLocation("/dashboard");
    } else if (user.role === "admin") {
      console.log("Admin access granted for user:", user.email, "Role:", user.role);
    }
  }, [user, isLoading, toast, setLocation]);

  // Show loading while checking authentication or switching to admin in dev
  if (isLoading || (import.meta.env.DEV && devLoggingIn)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">
            {import.meta.env.DEV ? "Loading admin dashboard..." : "Verifying admin access..."}
          </p>
        </div>
      </div>
    );
  }

  // In dev, show loading while waiting for the admin user to be set
  if (import.meta.env.DEV && user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  // Handle unauthenticated users (production only)
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

  // Handle non-admin users (production only)
  if (user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-destructive mx-auto"></div>
          <p className="text-muted-foreground">Access denied. Redirecting...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
