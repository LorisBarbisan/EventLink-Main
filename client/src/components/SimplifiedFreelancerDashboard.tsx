import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TabBadge } from '@/components/ui/tab-badge';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useProfile } from '@/hooks/useProfile';
import { useNotifications } from '@/hooks/useNotifications';
import { useBadgeCounts } from '@/hooks/useBadgeCounts';
import { apiRequest } from '@/lib/queryClient';
import { Briefcase, BookOpen, CheckCircle, Clock, AlertCircle, MessageCircle, Star } from 'lucide-react';
import { RatingDisplay } from '@/components/StarRating';
import { useFreelancerAverageRating } from '@/hooks/useRatings';
import { useToast } from '@/hooks/use-toast';
import { ProfileForm } from './ProfileForm';
import { ApplicationCard } from './ApplicationCard';
import { MessagingInterface } from './MessagingInterface';
import type { JobApplication, FreelancerFormData } from '@shared/types';

export default function SimplifiedFreelancerDashboard() {
  const { user } = useOptimizedAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get rating data for current user
  const { data: averageRating } = useFreelancerAverageRating(user?.id || 0);
  const [activeTab, setActiveTab] = useState('profile');

  // Get badge counts for tabs
  const { roleSpecificCounts, markCategoryAsRead } = useBadgeCounts({
    enabled: !!user?.id,
    refetchInterval: activeTab === 'messages' ? 10000 : 15000, // Poll faster when on messages tab
  });

  // Fetch freelancer profile data
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['/api/freelancer/profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const data = await apiRequest(`/api/freelancer/${user.id}`);
      return data;
    },
    retry: false,
    enabled: !!user?.id,
  });

  // Get user's job applications
  const { data: jobApplications = [], isLoading: applicationsLoading } = useQuery({
    queryKey: ['/api/freelancer/applications', user?.id],
    queryFn: async () => {
      return await apiRequest(`/api/freelancer/${user?.id}/applications`);
    },
    retry: false,
    enabled: !!user?.id,
  });

  // Fetch unread message count with optimized polling
  const { data: unreadCount } = useQuery({
    queryKey: ['/api/messages/unread-count', user?.id],
    queryFn: () => apiRequest(`/api/messages/unread-count?userId=${user?.id}`),
    refetchInterval: activeTab === 'messages' ? 15000 : 30000, // Poll faster only when on messages tab
    refetchIntervalInBackground: false, // Stop when tab is inactive
    enabled: !!user?.id,
  });

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    
    // Mark category notifications as read when tab is opened
    if (tab === 'jobs') {
      markCategoryAsRead('applications');
    } else if (tab === 'messages') {
      markCategoryAsRead('messages');
    } else if (tab === 'bookings') {
      markCategoryAsRead('ratings');
    }
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
          <TabsTrigger value="jobs" className="flex items-center">
            My Applications
            <TabBadge count={roleSpecificCounts.applications || 0} />
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex items-center">
            Messages
            <TabBadge count={roleSpecificCounts.messages || 0} />
          </TabsTrigger>
          <TabsTrigger value="bookings" className="flex items-center">
            Ratings
            <TabBadge count={roleSpecificCounts.ratings || 0} />
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          {profileLoading ? (
            <div className="flex justify-center p-8">Loading profile...</div>
          ) : (
            <ProfileForm
              profile={profile}
              userType="freelancer"
              onSave={async (formData) => {
              try {
                console.log('🚀 SAVE CLICKED! Saving freelancer profile data:', formData);
                
                // Use the correct API endpoint for freelancer profiles
                // Build update data excluding CV fields (managed separately by CV upload/delete)
                const freelancerData = formData as FreelancerFormData;
                
                const processedData: any = {
                  user_id: user.id,
                  first_name: freelancerData.first_name,
                  last_name: freelancerData.last_name,
                  title: freelancerData.title,
                  bio: freelancerData.bio,
                  location: freelancerData.location,
                  skills: freelancerData.skills,
                  portfolio_url: freelancerData.portfolio_url,
                  linkedin_url: freelancerData.linkedin_url,
                  website_url: freelancerData.website_url,
                  availability_status: freelancerData.availability_status,
                  profile_photo_url: freelancerData.profile_photo_url,
                  experience_years: freelancerData.experience_years ? parseInt(freelancerData.experience_years.toString()) : undefined,
                };
                console.log('📤 Sending processed data (CV fields excluded):', processedData);

                const savedProfile = await apiRequest(`/api/freelancer/${user.id}`, {
                  method: 'PUT',
                  body: JSON.stringify(processedData)
                });
                console.log('✅ Profile saved successfully:', savedProfile);
                
                // Force refetch to update UI with saved data
                console.log('🔄 Forcing refetch for user:', user?.id);
                await queryClient.refetchQueries({ 
                  queryKey: ['/api/freelancer/profile', user?.id], 
                  exact: true,
                  type: 'active'
                });
                console.log('🔄 Profile refetched with saved data!');
                
                // Show success message with toast
                toast({
                  title: "Profile saved successfully!",
                  description: "Your changes have been updated.",
                });
                
              } catch (error) {
                console.error('Error saving profile:', error);
                toast({
                  title: "Failed to save profile",
                  description: `${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
                  variant: "destructive",
                });
              }
            }}
            isSaving={false}
          />
          )}
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
              {jobApplications
                .filter((application: JobApplication) => application.status !== 'hired')
                .map((application: JobApplication) => (
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
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                  <div className="text-center">
                    <div className="flex items-center justify-center w-8 h-8 bg-yellow-100 dark:bg-yellow-900/20 rounded-full mx-auto mb-2">
                      <Star className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div className="text-2xl font-bold">
                      {averageRating?.count || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Ratings</div>
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
          </div>
          {user && (
            <MessagingInterface />
          )}
        </TabsContent>

        {/* Bookings Tab */}
        <TabsContent value="bookings" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">My Bookings</h2>
            <p className="text-muted-foreground">Manage your confirmed job bookings and schedule</p>
          </div>

          {applicationsLoading ? (
            <div className="flex justify-center p-8">Loading bookings...</div>
          ) : jobApplications.filter((app: JobApplication) => app.status === 'hired').length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Bookings Yet</h3>
                <p className="text-muted-foreground">
                  When you get hired for jobs, they will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {jobApplications
                .filter((application: JobApplication) => application.status === 'hired')
                .map((application: JobApplication) => (
                  <ApplicationCard
                    key={application.id}
                    application={application}
                    userType="freelancer"
                    currentUserId={user.id}
                  />
                ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}