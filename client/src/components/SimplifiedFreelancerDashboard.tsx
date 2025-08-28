import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useNotifications } from '@/hooks/useNotifications';
import { apiRequest } from '@/lib/queryClient';
import { Briefcase, BookOpen, CheckCircle, Clock, AlertCircle, MessageCircle } from 'lucide-react';
import { ProfileForm } from './ProfileForm';
import { ApplicationCard } from './ApplicationCard';
import { MessagingInterface } from './MessagingInterface';
import { NewConversationModal } from './NewConversationModal';
import type { JobApplication } from '@shared/types';

export default function SimplifiedFreelancerDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  // Use custom hooks
  const { profile, loading: profileLoading } = useProfile();
  const notifications = useNotifications();

  // Get user's job applications
  const { data: jobApplications = [], isLoading: applicationsLoading } = useQuery({
    queryKey: ['/api/freelancer/applications', user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/freelancer/${user?.id}/applications`);
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error('Failed to fetch applications');
      }
      return response.json();
    },
    retry: false,
    enabled: !!user?.id,
  });

  // Fetch unread message count
  const { data: unreadCount } = useQuery({
    queryKey: ['/api/messages/unread-count', user?.id],
    queryFn: () => apiRequest(`/api/messages/unread-count?userId=${user?.id}`),
    refetchInterval: 5000,
    enabled: !!user?.id,
  });

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  if (!user) {
    return <div>Please log in to access the dashboard.</div>;
  }

  // Simplified notification check
  const hasNewJobUpdates = false;

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Freelancer Dashboard</h1>
        <p className="text-muted-foreground">Manage your profile, applications, and messages</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile">Edit Profile</TabsTrigger>
          <TabsTrigger value="jobs" className="relative">
            My Applications
            {hasNewJobUpdates && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>
            )}
          </TabsTrigger>
          <TabsTrigger value="messages" className="relative">
            Messages
            {unreadCount > 0 && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>
            )}
          </TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <ProfileForm
            profile={profile}
            userType="freelancer"
            onSave={() => {}}
            isSaving={false}
          />
        </TabsContent>

        {/* Jobs/Applications Tab */}
        <TabsContent value="jobs" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">My Job Applications</h2>
            <p className="text-muted-foreground">Track your application status and responses</p>
          </div>

          {applicationsLoading ? (
            <div className="flex justify-center p-8">Loading applications...</div>
          ) : jobApplications.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Briefcase className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Applications Yet</h3>
                <p className="text-muted-foreground">
                  Start applying to jobs to see your applications here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {jobApplications.map((application: JobApplication) => (
                <ApplicationCard
                  key={application.id}
                  application={application}
                  userType="freelancer"
                  currentUserId={user.id}
                />
              ))}
            </div>
          )}

          {/* Application Status Summary */}
          {jobApplications.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <h3 className="font-medium mb-4">Application Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center w-8 h-8 bg-yellow-100 dark:bg-yellow-900/20 rounded-full mx-auto mb-2">
                      <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div className="text-2xl font-bold">
                      {jobApplications.filter((app: JobApplication) => app.status === 'pending').length}
                    </div>
                    <div className="text-sm text-muted-foreground">Pending</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-full mx-auto mb-2">
                      <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="text-2xl font-bold">
                      {jobApplications.filter((app: JobApplication) => app.status === 'reviewed').length}
                    </div>
                    <div className="text-sm text-muted-foreground">Reviewed</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-full mx-auto mb-2">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {jobApplications.filter((app: JobApplication) => app.status === 'hired').length}
                    </div>
                    <div className="text-sm text-muted-foreground">Hired</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center w-8 h-8 bg-red-100 dark:bg-red-900/20 rounded-full mx-auto mb-2">
                      <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="text-2xl font-bold">
                      {jobApplications.filter((app: JobApplication) => app.status === 'rejected').length}
                    </div>
                    <div className="text-sm text-muted-foreground">Rejected</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages" className="space-y-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold">Messages</h2>
              <p className="text-muted-foreground">Communicate with recruiters and potential employers</p>
            </div>
            {user && (
              <NewConversationModal 
                currentUser={{ id: user.id, email: user.email, role: 'freelancer' }}
              />
            )}
          </div>
          {user && (
            <MessagingInterface 
              currentUser={{ id: user.id, email: user.email, role: 'freelancer' }}
            />
          )}
        </TabsContent>

        {/* Bookings Tab */}
        <TabsContent value="bookings" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">My Bookings</h2>
            <p className="text-muted-foreground">Manage your confirmed job bookings and schedule</p>
          </div>

          <Card>
            <CardContent className="p-8 text-center">
              <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Bookings Yet</h3>
              <p className="text-muted-foreground">
                When you get hired for jobs, they will appear here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}