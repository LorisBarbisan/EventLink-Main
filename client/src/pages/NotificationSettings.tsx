import { Layout } from "@/components/Layout";
import { NotificationSettingsForm } from "@/components/notifications/NotificationSettingsForm";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function NotificationSettings() {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      setLocation("/auth");
    }
  }, [loading, user, setLocation]);

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-3xl mx-auto space-y-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Notification Settings</h1>
            <p className="text-muted-foreground">Manage your email notifications and job alerts.</p>
          </div>
          <NotificationSettingsForm user={user} />
        </div>
      </div>
    </Layout>
  );
}
