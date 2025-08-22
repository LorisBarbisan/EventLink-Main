import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useNotifications } from '@/hooks/useNotifications';
import { apiRequest } from '@/lib/queryClient';
import { Plus, Briefcase, Users } from 'lucide-react';
import { ProfileForm } from './ProfileForm';
import { JobForm } from './JobForm';
import { JobCard } from './JobCard';
import { ApplicationCard } from './ApplicationCard';
import { MessagingInterface } from './MessagingInterface';
import { NewConversationModal } from './NewConversationModal';
import type { Job, JobApplication, JobFormData } from '@shared/types';

export default function SimplifiedRecruiterDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('profile');
  const [showJobForm, setShowJobForm] = useState(false);
  const [expandedJobs, setExpandedJobs] = useState<Set<number>>(new Set());

  // Use custom hooks
  const { profile, isLoading: profileLoading, saveProfile, isSaving } = useProfile({
    userId: user?.id || 0,
    userType: 'recruiter'
  });

  const { notifyApplicationUpdate } = useNotifications({
    userId: user?.id
  });

  // Fetch jobs
  const { data: myJobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['/api/jobs/recruiter', user?.id],
    queryFn: () => apiRequest(`/api/jobs/recruiter/${user?.id}`),
    enabled: !!user?.id,
  });

  // Fetch applications
  const { data: applications = [], isLoading: applicationsLoading } = useQuery({
    queryKey: ['/api/recruiter', user?.id, 'applications'],
    queryFn: () => apiRequest(`/api/recruiter/${user?.id}/applications`),
    enabled: !!user?.id,
  });

  // Fetch unread message count
  const { data: unreadCount } = useQuery({
    queryKey: ['/api/messages/unread-count', user?.id],
    queryFn: () => apiRequest(`/api/messages/unread-count?userId=${user?.id}`),
    refetchInterval: 10000,
    enabled: !!user?.id,
  });

  // Create job mutation
  const createJobMutation = useMutation({
    mutationFn: async (jobData: JobFormData) => {
      return await apiRequest('/api/jobs', {
        method: 'POST',
        body: JSON.stringify({
          recruiter_id: user?.id,
          company: (profile as any)?.company_name || 'Company',
          status: 'active',
          ...jobData
        }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs/recruiter', user?.id] });
      toast({
        title: 'Job posted',
        description: 'Your job has been posted successfully.',
      });
      setShowJobForm(false);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to post job.',
        variant: 'destructive',
      });
    },
  });

  // Helper functions
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'applications') {
      markAsViewed('applications');
    } else if (tab === 'jobs') {
      markAsViewed('jobs');
    }
  };

  const toggleJobExpansion = (jobId: number) => {
    const newExpanded = new Set(expandedJobs);
    if (newExpanded.has(jobId)) {
      newExpanded.delete(jobId);
    } else {
      newExpanded.add(jobId);
    }
    setExpandedJobs(newExpanded);
  };

  const getHiredApplicantsForJob = (jobId: number): JobApplication[] => {
    return applications.filter((app: JobApplication) => 
      app.job_id === jobId && app.status === 'hired'
    );
  };

  const handleJobSubmit = (jobData: JobFormData) => {
    if (!user?.id || !(profile as any)?.company_name) {
      toast({
        title: 'Error',
        description: 'Please complete your company profile first.',
        variant: 'destructive',
      });
      return;
    }
    createJobMutation.mutate(jobData);
  };

  if (!user) {
    return <div>Please log in to access the dashboard.</div>;
  }

  // Check for new notifications
  const hasNewApplications = hasNewNotifications(applications, lastViewed.applications);
  const hasNewJobUpdates = hasNewNotifications(applications.filter((app: JobApplication) => 
    app.status === 'rejected' || app.status === 'hired'
  ), lastViewed.jobs, 'updated_at');

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Recruiter Dashboard</h1>
        <p className="text-muted-foreground">Manage your company profile, job postings, and applications</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile">Company Profile</TabsTrigger>
          <TabsTrigger value="jobs" className="relative">
            My Jobs
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
          <TabsTrigger value="applications" className="relative">
            Applications
            {hasNewApplications && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <ProfileForm
            profile={profile}
            userType="recruiter"
            onSave={saveProfile}
            isSaving={isSaving}
          />
        </TabsContent>

        {/* Jobs Tab */}
        <TabsContent value="jobs" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">My Job Postings</h2>
              <p className="text-muted-foreground">Manage your job listings and track applications</p>
            </div>
            <Button onClick={() => setShowJobForm(!showJobForm)} data-testid="button-post-job">
              <Plus className="w-4 h-4 mr-2" />
              Post New Job
            </Button>
          </div>

          {showJobForm && (
            <JobForm
              onSubmit={handleJobSubmit}
              onCancel={() => setShowJobForm(false)}
              isSubmitting={createJobMutation.isPending}
            />
          )}

          <div className="space-y-4">
            {jobsLoading ? (
              <div className="flex justify-center p-8">Loading jobs...</div>
            ) : myJobs.length > 0 ? (
              myJobs.map((job: Job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  hiredApplicants={getHiredApplicantsForJob(job.id)}
                  onExpandToggle={toggleJobExpansion}
                  isExpanded={expandedJobs.has(job.id)}
                  showHiredSection={true}
                  currentUserId={user?.id || 0}
                />
              ))
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Jobs Posted Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Start by posting your first job to find talented crew members.
                  </p>
                  <Button onClick={() => setShowJobForm(true)} data-testid="button-post-first-job">
                    Post Your First Job
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages" className="space-y-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold">Messages</h2>
              <p className="text-muted-foreground">Communicate with freelancers and applicants</p>
            </div>
            {user && (
              <NewConversationModal 
                currentUser={{ id: user.id, email: user.email, role: 'recruiter' }}
              />
            )}
          </div>
          {user && (
            <MessagingInterface 
              currentUser={{ id: user.id, email: user.email, role: 'recruiter' }}
            />
          )}
        </TabsContent>

        {/* Applications Tab */}
        <TabsContent value="applications" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Applications</h2>
            <p className="text-muted-foreground">Review and manage job applications</p>
          </div>

          {applicationsLoading ? (
            <div className="flex justify-center p-8">
              <div>Loading applications...</div>
            </div>
          ) : applications.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Applications Yet</h3>
                <p className="text-muted-foreground">Job applications will appear here when freelancers apply to your posted jobs.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {applications.map((application: JobApplication) => (
                <ApplicationCard
                  key={application.id}
                  application={application}
                  userType="recruiter"
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