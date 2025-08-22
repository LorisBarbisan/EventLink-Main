import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { SettingsForm } from '@/components/SettingsForm';
import { Skeleton } from '@/components/ui/skeleton';

export default function Settings() {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto space-y-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    setLocation('/auth');
    return null;
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Manage your account settings and preferences.</p>
          </div>
          <SettingsForm user={user} />
        </div>
      </div>
    </Layout>
  );
}