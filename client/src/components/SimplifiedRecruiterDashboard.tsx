import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TabBadge } from '@/components/ui/tab-badge';
import { useToast } from '@/hooks/use-toast';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useProfile } from '@/hooks/useProfile';
import { useNotifications } from '@/hooks/useNotifications';
import { useBadgeCounts } from '@/hooks/useBadgeCounts';
import { apiRequest } from '@/lib/queryClient';
import { Plus, Briefcase, Users } from 'lucide-react';
import { ProfileForm } from './ProfileForm';
import { JobForm } from './JobForm';
import { JobCard } from './JobCard';
import { ApplicationCard } from './ApplicationCard';
import { MessagingInterface } from './MessagingInterface';
import { useLocation } from 'wouter';
import type { Job, JobApplication, JobFormData } from '@shared/types';

export default function SimplifiedRecruiterDashboard() {
  const { user } = useOptimizedAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState('profile');
  const [showJobForm, setShowJobForm] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [expandedJobs, setExpandedJobs] = useState<Set<number>>(new Set());

  // Get badge counts for tabs
  const { roleSpecificCounts, markCategoryAsRead } = useBadgeCounts({
    enabled: !!user?.id,
    refetchInterval: activeTab === 'messages' ? 10000 : 15000, // Poll faster when on messages tab
  });

  // Handle URL parameters for direct navigation to job posting
  useEffect(() => {
    const handleSearchParams = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      const actionParam = urlParams.get('action');
      
      if (tabParam === 'jobs') {
        setActiveTab('jobs');
        if (actionParam === 'post') {
          setShowJobForm(true);
          // Clear the action parameter to prevent repeated triggers
          urlParams.delete('action');
          const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ''}`;
          window.history.replaceState({}, '', newUrl);
        }
      }
    };

    // Check on mount
    handleSearchParams();

    // Listen for navigation events (including search parameter changes)
    const handlePopState = () => handleSearchParams();
    window.addEventListener('popstate', handlePopState);
    
    // For programmatic navigation (our case), we need to listen for location changes
    // Since wouter doesn't trigger popstate for programmatic navigation, 
    // we'll use a MutationObserver approach or check periodically
    let lastSearch = window.location.search;
    const checkSearch = () => {
      if (window.location.search !== lastSearch) {
        lastSearch = window.location.search;
        handleSearchParams();
      }
    };
    const intervalId = setInterval(checkSearch, 100);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      clearInterval(intervalId);
    };
  }, []); // Only run once on mount

  // Use custom hooks - only call when user ID is available
  const { profile, isLoading: profileLoading, saveProfile, isSaving } = useProfile({
    userId: user?.id || 0,
    userType: 'recruiter'
  });

  // Remove the problematic notification hook for now
  // const { notifyApplicationUpdate } = useNotifications({
  //   userId: user?.id
  // });

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
    select: (data) => {
      // Filter out applications for jobs that might have been deleted
      return data.filter((app: JobApplication) => {
        // Only show applications that have valid job data
        return app.job_title && app.job_company;
      });
    },
  });

  // Fetch unread message count with optimized polling
  const { data: unreadCount } = useQuery({
    queryKey: ['/api/messages/unread-count', user?.id],
    queryFn: () => apiRequest(`/api/messages/unread-count?userId=${user?.id}`),
    refetchInterval: activeTab === 'messages' ? 15000 : 30000, // Poll faster only when on messages tab
    refetchIntervalInBackground: false, // Stop when tab is inactive
    enabled: !!user?.id,
  });

  // Create job mutation
  const createJobMutation = useMutation({
    mutationFn: async (jobData: JobFormData) => {
      // Convert string numbers to integers for days and hours
      // Remove empty string fields to prevent validation errors
      const processedData: any = { ...jobData };
      if (jobData.days && jobData.days !== '') {
        processedData.days = parseInt(jobData.days);
      } else {
        delete processedData.days;
      }
      if (jobData.hours && jobData.hours !== '') {
        processedData.hours = parseInt(jobData.hours);
      } else {
        delete processedData.hours;
      }
      // Remove empty duration fields
      if (!processedData.start_time || processedData.start_time === '') delete processedData.start_time;
      if (!processedData.end_time || processedData.end_time === '') delete processedData.end_time;
      
      const requestPayload = {
        recruiter_id: user?.id,
        company: (profile as any)?.company_name || 'Company',
        status: 'active',
        ...processedData
      };
      
      console.log('📤 Sending job creation request:', JSON.stringify(requestPayload, null, 2));
      
      return await apiRequest('/api/jobs', {
        method: 'POST',
        body: JSON.stringify(requestPayload),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      console.log('🎯 Job created successfully! Refetching all job lists...');
      
      // Force immediate refetch of both job lists
      queryClient.refetchQueries({ queryKey: ['/api/jobs/recruiter', user?.id] });
      queryClient.refetchQueries({ queryKey: ['/api/jobs'] });
      
      console.log('✅ Jobs refetch initiated');
      
      toast({
        title: 'Job posted',
        description: 'Your job has been posted successfully.',
      });
      setShowJobForm(false);
    },
    onError: (error: any) => {
      console.error('❌ Job creation error:', error);
      const errorMessage = error?.message || error?.error || 'Failed to post job.';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  // Update job mutation
  const updateJobMutation = useMutation({
    mutationFn: async (jobData: JobFormData & { id: number }) => {
      // Convert string numbers to integers for days and hours
      // Remove empty string fields to prevent validation errors
      const processedData: any = { ...jobData };
      if (jobData.days && jobData.days !== '') {
        processedData.days = parseInt(jobData.days);
      } else {
        delete processedData.days;
      }
      if (jobData.hours && jobData.hours !== '') {
        processedData.hours = parseInt(jobData.hours);
      } else {
        delete processedData.hours;
      }
      // Remove empty duration fields
      if (!processedData.start_time || processedData.start_time === '') delete processedData.start_time;
      if (!processedData.end_time || processedData.end_time === '') delete processedData.end_time;
      
      return await apiRequest(`/api/jobs/${jobData.id}`, {
        method: 'PUT',
        body: JSON.stringify(processedData),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      // Force immediate refetch of both job lists for updates too
      queryClient.refetchQueries({ queryKey: ['/api/jobs/recruiter', user?.id] });
      queryClient.refetchQueries({ queryKey: ['/api/jobs'] });
      setEditingJob(null);
      toast({
        title: 'Success',
        description: 'Job updated successfully!',
      });
    },
    onError: (error: any) => {
      console.error('❌ Job update error:', error);
      const errorMessage = error?.message || error?.error || 'Failed to update job. Please try again.';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  // Delete job mutation
  const deleteJobMutation = useMutation({
    mutationFn: async (jobId: number) => {
      return await apiRequest(`/api/jobs/${jobId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs/recruiter', user?.id] });
      toast({
        title: 'Success',
        description: 'Job deleted successfully!',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete job. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Helper functions
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    
    // Mark category notifications as read when tab is opened
    if (tab === 'jobs') {
      markCategoryAsRead('jobs');
    } else if (tab === 'messages') {
      markCategoryAsRead('messages');
    } else if (tab === 'applications') {
      markCategoryAsRead('applications');
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

  const getApplicantCountForJob = (jobId: number): number => {
    return applications.filter((app: JobApplication) => app.job_id === jobId).length;
  };

  const handleJobSubmit = (jobData: JobFormData) => {
    if (editingJob) {
      updateJobMutation.mutate({ ...jobData, id: editingJob.id });
    } else {
      const companyName = (profile as any)?.company_name?.trim();
      if (!user?.id || !companyName) {
        toast({
          title: 'Error',
          description: 'Please complete your company profile first. Make sure to add your company name.',
          variant: 'destructive',
        });
        return;
      }
      createJobMutation.mutate(jobData);
    }
  };

  const handleJobEdit = (jobId: number) => {
    const job = myJobs.find((j: Job) => j.id === jobId);
    if (job) {
      setEditingJob(job);
    }
  };

  const handleJobDelete = (jobId: number) => {
    deleteJobMutation.mutate(jobId);
  };

  const handleCancelEdit = () => {
    setEditingJob(null);
    setShowJobForm(false);
  };

  if (!user) {
    return <div>Please log in to access the dashboard.</div>;
  }

  // Simplified notification indicators
  const hasNewApplications = applications.some((app: JobApplication) => app.status === 'pending');
  const hasNewJobUpdates = applications.some((app: JobApplication) => 
    app.status === 'rejected' || app.status === 'hired'
  );

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Recruiter Dashboard</h1>
        <p className="text-muted-foreground">Manage your company profile, job postings, and applications</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile">Company Profile</TabsTrigger>
          <TabsTrigger value="jobs" className="flex items-center">
            My Jobs
            <TabBadge count={roleSpecificCounts.jobs || 0} />
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex items-center">
            Messages
            <TabBadge count={roleSpecificCounts.messages || 0} />
          </TabsTrigger>
          <TabsTrigger value="applications" className="flex items-center">
            Applications
            <TabBadge count={roleSpecificCounts.applications || 0} />
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

          {(showJobForm || editingJob) && (
            <JobForm
              initialData={editingJob}
              onSubmit={handleJobSubmit}
              onCancel={handleCancelEdit}
              isSubmitting={createJobMutation.isPending || updateJobMutation.isPending}
              isEditing={!!editingJob}
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
                  applicantCount={getApplicantCountForJob(job.id)}
                  onEdit={handleJobEdit}
                  onDelete={handleJobDelete}
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