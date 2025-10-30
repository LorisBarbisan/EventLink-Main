import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Bell, Mail, Briefcase, MessageSquare, Star } from 'lucide-react';
import type { User } from '@shared/schema';

interface NotificationSettingsFormProps {
  user: User;
}

interface NotificationPreferences {
  id: number;
  user_id: number;
  email_messages: boolean;
  email_application_updates: boolean;
  email_job_updates: boolean;
  email_job_alerts: boolean;
  email_rating_requests: boolean;
  email_system_updates: boolean;
  digest_mode: 'instant' | 'daily' | 'weekly';
  digest_time: string;
}

export function NotificationSettingsForm({ user }: NotificationSettingsFormProps) {
  const { toast } = useToast();
  const [localPreferences, setLocalPreferences] = useState<NotificationPreferences | null>(null);

  // Fetch notification preferences
  const { data: preferences, isLoading } = useQuery<NotificationPreferences>({
    queryKey: ['/api/notifications/settings'],
  });

  // Update local state when preferences are loaded
  useEffect(() => {
    if (preferences) {
      setLocalPreferences(preferences);
    }
  }, [preferences]);

  // Update preferences mutation
  const updateMutation = useMutation({
    mutationFn: async (newPreferences: Partial<NotificationPreferences>) => {
      return await apiRequest('/api/notifications/settings', {
        method: 'POST',
        body: JSON.stringify(newPreferences),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/settings'] });
      toast({
        title: 'Settings saved',
        description: 'Your notification preferences have been updated.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update notification preferences.',
        variant: 'destructive',
      });
    },
  });

  const handleToggle = (key: keyof NotificationPreferences, value: boolean) => {
    if (!localPreferences) return;

    const newPreferences = { ...localPreferences, [key]: value };
    setLocalPreferences(newPreferences);
    updateMutation.mutate({ [key]: value });
  };

  if (isLoading || !localPreferences) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="h-12 bg-muted animate-pulse rounded" />
            <div className="h-12 bg-muted animate-pulse rounded" />
            <div className="h-12 bg-muted animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Email Notifications
          </CardTitle>
          <CardDescription>
            Choose which email notifications you'd like to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Messages */}
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <MessageSquare className="h-5 w-5 mt-0.5 text-muted-foreground" />
              <div className="space-y-1">
                <Label
                  htmlFor="email_messages"
                  className="text-base font-medium cursor-pointer"
                  data-testid="label-email-messages"
                >
                  New Messages
                </Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when you receive a new internal message
                </p>
              </div>
            </div>
            <Switch
              id="email_messages"
              checked={localPreferences.email_messages}
              onCheckedChange={(checked) => handleToggle('email_messages', checked)}
              data-testid="switch-email-messages"
            />
          </div>

          <Separator />

          {/* Application Updates (Freelancers only) */}
          {user.role === 'freelancer' && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <Briefcase className="h-5 w-5 mt-0.5 text-muted-foreground" />
                  <div className="space-y-1">
                    <Label
                      htmlFor="email_application_updates"
                      className="text-base font-medium cursor-pointer"
                      data-testid="label-email-application-updates"
                    >
                      Application Updates
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when your job application status changes
                    </p>
                  </div>
                </div>
                <Switch
                  id="email_application_updates"
                  checked={localPreferences.email_application_updates}
                  onCheckedChange={(checked) => handleToggle('email_application_updates', checked)}
                  data-testid="switch-email-application-updates"
                />
              </div>
              <Separator />
            </>
          )}

          {/* Job Updates (Recruiters only) */}
          {user.role === 'recruiter' && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <Briefcase className="h-5 w-5 mt-0.5 text-muted-foreground" />
                  <div className="space-y-1">
                    <Label
                      htmlFor="email_job_updates"
                      className="text-base font-medium cursor-pointer"
                      data-testid="label-email-job-updates"
                    >
                      Job Applications
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when freelancers apply to your posted jobs
                    </p>
                  </div>
                </div>
                <Switch
                  id="email_job_updates"
                  checked={localPreferences.email_job_updates}
                  onCheckedChange={(checked) => handleToggle('email_job_updates', checked)}
                  data-testid="switch-email-job-updates"
                />
              </div>
              <Separator />
            </>
          )}

          {/* Job Alerts (Freelancers only) */}
          {user.role === 'freelancer' && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 mt-0.5 text-muted-foreground" />
                  <div className="space-y-1">
                    <Label
                      htmlFor="email_job_alerts"
                      className="text-base font-medium cursor-pointer"
                      data-testid="label-email-job-alerts"
                    >
                      Job Alerts
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified about new job posts matching your preferences
                    </p>
                  </div>
                </div>
                <Switch
                  id="email_job_alerts"
                  checked={localPreferences.email_job_alerts}
                  onCheckedChange={(checked) => handleToggle('email_job_alerts', checked)}
                  data-testid="switch-email-job-alerts"
                />
              </div>
              <Separator />
            </>
          )}

          {/* Rating Requests */}
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <Star className="h-5 w-5 mt-0.5 text-muted-foreground" />
              <div className="space-y-1">
                <Label
                  htmlFor="email_rating_requests"
                  className="text-base font-medium cursor-pointer"
                  data-testid="label-email-rating-requests"
                >
                  Rating Requests
                </Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when someone requests a rating from you
                </p>
              </div>
            </div>
            <Switch
              id="email_rating_requests"
              checked={localPreferences.email_rating_requests}
              onCheckedChange={(checked) => handleToggle('email_rating_requests', checked)}
              data-testid="switch-email-rating-requests"
            />
          </div>

          <Separator />

          {/* System Updates */}
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <Bell className="h-5 w-5 mt-0.5 text-muted-foreground" />
              <div className="space-y-1">
                <Label
                  htmlFor="email_system_updates"
                  className="text-base font-medium cursor-pointer"
                  data-testid="label-email-system-updates"
                >
                  Platform Updates
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive important announcements and platform updates
                </p>
              </div>
            </div>
            <Switch
              id="email_system_updates"
              checked={localPreferences.email_system_updates}
              onCheckedChange={(checked) => handleToggle('email_system_updates', checked)}
              data-testid="switch-email-system-updates"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
