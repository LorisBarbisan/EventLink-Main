import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TabBadge } from "@/components/ui/tab-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { useProfile } from "@/hooks/useProfile";
import { apiRequest } from "@/lib/queryClient";
import type { Job, JobApplication, JobFormData } from "@shared/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Briefcase, Loader2, MapPin, Plus, Search, Star, User, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ApplicationCard } from "./ApplicationCard";
import { InviteFreelancerModal } from "./InviteFreelancerModal";
import { InvitedFreelancersDialog } from "./InvitedFreelancersDialog";
import { JobCard } from "./JobCard";
import { JobForm } from "./JobForm";
import { MessagingInterface } from "./MessagingInterface";
import { ProfileForm } from "./ProfileForm";

export default function SimplifiedRecruiterDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("profile");
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [showJobForm, setShowJobForm] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [expandedJobs, setExpandedJobs] = useState<Set<number>>(new Set());
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [selectedJobForInvite, setSelectedJobForInvite] = useState<{
    id: number;
    title: string;
  } | null>(null);
  const [viewInvitedJob, setViewInvitedJob] = useState<{
    id: number;
    title: string;
  } | null>(null);

  const [crewTab, setCrewTab] = useState<"all" | "saved" | "worked">("all");
  const [crewSearch, setCrewSearch] = useState("");
  const [crewLocation, setCrewLocation] = useState("");

  const [jobSearch, setJobSearch] = useState("");
  const [jobStatusFilter, setJobStatusFilter] = useState<"all" | "active" | "private" | "closed">("all");

  const [appSearch, setAppSearch] = useState("");
  const [appStatusFilter, setAppStatusFilter] = useState<"all" | "applied" | "hired" | "invited" | "rejected" | "declined">("all");

  // Get badge counts for tabs
  const { roleSpecificCounts, markCategoryAsRead } = useBadgeCounts({
    enabled: !!user?.id,
    refetchInterval: activeTab === "messages" ? 10000 : 15000, // Poll faster when on messages tab
  });

  // Handle URL parameters for direct navigation to job posting and messages
  useEffect(() => {
    const handleSearchParams = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get("tab");
      const actionParam = urlParams.get("action");

      // Switch to tab specified in URL (e.g., from notifications)
      if (tabParam && ["profile", "jobs", "applications", "messages", "crew"].includes(tabParam)) {
        if (tabParam !== activeTab) {
          setActiveTab(tabParam);
        }
      }

      // Update active conversation if present
      const convParam =
        urlParams.get("conversation") ||
        urlParams.get("conversationId") ||
        urlParams.get("recipientId");
      const newConvId = convParam ? parseInt(convParam, 10) : null;
      if (newConvId !== activeConversationId) {
        setActiveConversationId(newConvId);
      }

      // Handle job posting action
      if (tabParam === "jobs" && actionParam === "post") {
        setShowJobForm(true);
        // Clear the action parameter to prevent repeated triggers
        urlParams.delete("action");
        const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""}`;
        window.history.replaceState({}, "", newUrl);
      }
    };

    // Check on mount
    handleSearchParams();

    // Listen for navigation events
    const handlePopState = () => handleSearchParams();
    window.addEventListener("popstate", handlePopState);

    // Poll for search param changes since wouter might not trigger on them
    let lastSearch = window.location.search;
    const intervalId = setInterval(() => {
      if (window.location.search !== lastSearch) {
        lastSearch = window.location.search;
        handleSearchParams();
      }
    }, 100);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      clearInterval(intervalId);
    };
  }, [activeTab]);

  // Use custom hooks - only call when user ID is available
  const {
    profile,
    isLoading: profileLoading,
    saveProfile,
    isSaving,
  } = useProfile({
    userId: user?.id || 0,
    userType: "recruiter",
  });

  // Remove the problematic notification hook for now
  // const { notifyApplicationUpdate } = useNotifications({
  //   userId: user?.id
  // });

  // Fetch jobs
  const { data: myJobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ["/api/jobs/recruiter", user?.id],
    queryFn: () => apiRequest(`/api/jobs/recruiter/${user?.id}`),
    enabled: !!user?.id,
  });

  // Fetch applications
  const { data: applications = [], isLoading: applicationsLoading } = useQuery({
    queryKey: ["/api/recruiter", user?.id, "applications"],
    queryFn: () => apiRequest(`/api/recruiter/${user?.id}/applications`),
    enabled: !!user?.id,
    select: data => {
      // Filter out applications for jobs that might have been deleted
      return data.filter((app: JobApplication) => {
        // Only show applications that have valid job data
        return app.job_title && app.job_company;
      });
    },
  });

  const crewQueryParams = new URLSearchParams();
  if (crewTab !== "all") crewQueryParams.set("tab", crewTab);
  if (crewSearch.trim()) crewQueryParams.set("keyword", crewSearch.trim());
  if (crewLocation.trim()) crewQueryParams.set("location", crewLocation.trim());
  const crewQueryString = crewQueryParams.toString();

  const { data: crewFreelancers = [], isLoading: crewLoading } = useQuery<any[]>({
    queryKey: ["/api/my-crew", crewTab, crewSearch, crewLocation],
    queryFn: () => apiRequest(`/api/my-crew${crewQueryString ? `?${crewQueryString}` : ""}`),
    enabled: !!user?.id && activeTab === "crew",
  });

  const unsaveCrewMutation = useMutation({
    mutationFn: async (freelancerId: number) => {
      return apiRequest(`/api/saved-freelancers/${freelancerId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-crew"] });
      queryClient.invalidateQueries({ queryKey: ["/api/saved-freelancers"] });
      toast({ title: "Removed from saved", description: "Freelancer removed from your saved list." });
    },
  });

  // Fetch unread message count with optimized polling
  const { data: unreadCount } = useQuery({
    queryKey: ["/api/messages/unread-count", user?.id],
    queryFn: () => apiRequest(`/api/messages/unread-count?userId=${user?.id}`),
    refetchInterval: activeTab === "messages" ? 15000 : 30000, // Poll faster only when on messages tab
    refetchIntervalInBackground: false, // Stop when tab is inactive
    enabled: !!user?.id,
  });

  // Create job mutation
  const createJobMutation = useMutation({
    mutationFn: async (jobData: JobFormData & { status: "active" | "private" }) => {
      // Remove empty string fields to prevent validation errors
      const processedData: any = { ...jobData };

      // Remove empty duration fields
      if (!processedData.start_time || processedData.start_time === "")
        delete processedData.start_time;
      if (!processedData.end_time || processedData.end_time === "") delete processedData.end_time;
      // Remove empty contract_type
      if (!processedData.contract_type || processedData.contract_type === "")
        delete processedData.contract_type;

      const requestPayload = {
        recruiter_id: user?.id,
        company: (profile as any)?.company_name || "Company",
        // status is included in processedData spread, but let's be explicit if needed or rely on spread
        // The JobFormData doesn't have status, but we are passing it in the extended type.
        ...processedData,
      };

      console.log("📤 Sending job creation request:", JSON.stringify(requestPayload, null, 2));

      return await apiRequest("/api/jobs", {
        method: "POST",
        body: JSON.stringify(requestPayload),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      console.log("🎯 Job created successfully! Invalidating all job caches...");

      // Invalidate queries to ensure fresh data on next fetch
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/recruiter", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });

      console.log("✅ Jobs cache invalidated");

      toast({
        title: "Job posted",
        description: "Your job has been posted successfully.",
      });
      setShowJobForm(false);
    },
    onError: (error: any) => {
      console.error("❌ Job creation error:", error);
      const errorMessage = error?.message || error?.error || "Failed to post job.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Update job mutation
  const updateJobMutation = useMutation({
    mutationFn: async (jobData: JobFormData & { id: number; status?: "active" | "private" }) => {
      // Remove empty string fields to prevent validation errors
      const processedData: any = { ...jobData };

      // Remove empty duration fields
      if (!processedData.start_time || processedData.start_time === "")
        delete processedData.start_time;
      if (!processedData.end_time || processedData.end_time === "") delete processedData.end_time;
      // Remove empty contract_type
      if (!processedData.contract_type || processedData.contract_type === "")
        delete processedData.contract_type;

      return await apiRequest(`/api/jobs/${jobData.id}`, {
        method: "PUT",
        body: JSON.stringify(processedData),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: (data, variables) => {
      // Invalidate queries to ensure fresh data on next fetch
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/recruiter", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setEditingJob(null);
      toast({
        title: "Success",
        description: `Job ${variables.status === "private" ? "saved" : "updated"} successfully!`,
      });
    },
    onError: (error: any) => {
      console.error("❌ Job update error:", error);
      const errorMessage =
        error?.message || error?.error || "Failed to update job. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Delete job mutation
  const deleteJobMutation = useMutation({
    mutationFn: async (jobId: number) => {
      return await apiRequest(`/api/jobs/${jobId}`, {
        method: "DELETE",
      });
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({
        queryKey: ["/api/jobs/recruiter", user?.id],
        type: "active",
      });
      await queryClient.refetchQueries({
        queryKey: ["/api/recruiter", user?.id, "applications"],
        type: "active",
      });
      toast({
        title: "Success",
        description: "Job deleted successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete job. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Publish job mutation
  const publishJobMutation = useMutation({
    mutationFn: async (jobId: number) => {
      return await apiRequest(`/api/jobs/${jobId}`, {
        method: "PUT",
        body: JSON.stringify({ status: "active" }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/recruiter", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Success",
        description: "Job published successfully!",
      });
    },
    onError: (error: any) => {
      console.error("❌ Job publish error:", error);
      toast({
        title: "Error",
        description: "Failed to publish job. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Unpublish job mutation (Unpost)
  const unpublishJobMutation = useMutation({
    mutationFn: async (jobId: number) => {
      return await apiRequest(`/api/jobs/${jobId}`, {
        method: "PUT",
        body: JSON.stringify({ status: "private" }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/recruiter", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Success",
        description: "Job has been unposted and is no longer visible publicly.",
      });
    },
    onError: (error: any) => {
      console.error("❌ Job unpublish error:", error);
      toast({
        title: "Error",
        description: "Failed to unpost job. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Close job mutation
  const closeJobMutation = useMutation({
    mutationFn: async (jobId: number) => {
      return await apiRequest(`/api/jobs/${jobId}/close`, {
        method: "PUT",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/recruiter", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recruiter", user?.id, "applications"] });
      toast({
        title: "Job Closed",
        description: "Job has been closed. No more applications or invitations will be accepted.",
      });
    },
    onError: (error: any) => {
      console.error("❌ Job close error:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to close job. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Helper functions
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);

    // Update URL to reflect tab change so polling doesn't revert it
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    // Remove conversation params when switching away from messages
    if (tab !== "messages") {
      url.searchParams.delete("conversation");
      url.searchParams.delete("conversationId");
      url.searchParams.delete("recipientId");
    }
    window.history.pushState({}, "", url.toString());

    // Mark category notifications as read when tab is opened
    // Mark category notifications as read when tab is opened
    // Note: Messages notifications are NOT marked as read automatically
    // They remain unread until user explicitly views/reads them
    if (tab === "jobs") {
      markCategoryAsRead("jobs");
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/recruiter", user?.id] });
    } else if (tab === "applications") {
      markCategoryAsRead("applications");
      // Force refetch applications to ensure new ones appear immediately
      queryClient.invalidateQueries({ queryKey: ["/api/recruiter", user?.id, "applications"] });
    }
    // Removed: markCategoryAsRead('messages') - keep message notifications unread until user reads them
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
    return applications.filter(
      (app: JobApplication) => app.job_id === jobId && app.status === "hired"
    );
  };

  const getApplicantCountForJob = (jobId: number): number => {
    return applications.filter((app: JobApplication) => app.job_id === jobId).length;
  };

  const handleJobSubmit = (jobData: JobFormData, status: "active" | "private") => {
    if (editingJob) {
      updateJobMutation.mutate({ ...jobData, id: editingJob.id, status });
    } else {
      const companyName = (profile as any)?.company_name?.trim();
      if (!user?.id || !companyName) {
        toast({
          title: "Error",
          description:
            "Please complete your company profile first. Make sure to add your company name.",
          variant: "destructive",
        });
        return;
      }
      createJobMutation.mutate({ ...jobData, status });
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

  const handlePublishJob = (jobId: number) => {
    publishJobMutation.mutate(jobId);
  };

  const handleJobUnpublish = (jobId: number) => {
    unpublishJobMutation.mutate(jobId);
  };

  const handleJobClose = (jobId: number) => {
    closeJobMutation.mutate(jobId);
  };

  const handleJobInvite = (jobId: number) => {
    const job = myJobs.find((j: Job) => j.id === jobId);
    if (job) {
      setSelectedJobForInvite({ id: job.id, title: job.title });
      setInviteModalOpen(true);
    }
  };

  const getInvitedCountForJob = (jobId: number): number => {
    return applications.filter(
      (app: JobApplication) => app.job_id === jobId && app.status === "invited"
    ).length;
  };

  const getInvitedApplicationsForJob = (jobId: number): JobApplication[] => {
    return applications.filter(
      (app: JobApplication) => app.job_id === jobId && app.status === "invited"
    );
  };

  const handleViewInvited = (jobId: number) => {
    const job = myJobs.find((j: Job) => j.id === jobId);
    if (job) {
      setViewInvitedJob({ id: job.id, title: job.title });
    }
  };

  const handleCancelEdit = () => {
    setEditingJob(null);
    setShowJobForm(false);
  };

  if (!user) {
    return <div>Please log in to access the dashboard.</div>;
  }

  // Simplified notification indicators
  const hasNewApplications = applications.some((app: JobApplication) => app.status === "pending");
  const hasNewJobUpdates = applications.some(
    (app: JobApplication) => app.status === "rejected" || app.status === "hired"
  );

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Employer Dashboard</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage your company profile, job postings, and applications
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="w-full grid grid-cols-3 sm:grid-cols-5 gap-2">
          <TabsTrigger value="profile" className="text-xs sm:text-sm">
            <span className="hidden sm:inline">Company Profile</span>
            <span className="sm:hidden">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="jobs" className="flex items-center justify-center text-xs sm:text-sm">
            <span className="hidden sm:inline">My Jobs</span>
            <span className="sm:hidden">Jobs</span>
            <TabBadge count={roleSpecificCounts.jobs || 0} />
          </TabsTrigger>
          <TabsTrigger
            value="crew"
            className="flex items-center justify-center text-xs sm:text-sm"
          >
            <span className="hidden sm:inline">My Crew</span>
            <span className="sm:hidden">Crew</span>
          </TabsTrigger>
          <TabsTrigger
            value="messages"
            className="flex items-center justify-center text-xs sm:text-sm"
          >
            Messages
            <TabBadge count={roleSpecificCounts.messages || 0} />
          </TabsTrigger>
          <TabsTrigger
            value="applications"
            className="flex items-center justify-center text-xs sm:text-sm"
          >
            <span className="hidden sm:inline">Applications</span>
            <span className="sm:hidden">Apps</span>
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

        {/* My Crew Tab */}
        <TabsContent value="crew" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">My Crew</h2>
            <p className="text-muted-foreground">
              Freelancers you've saved or worked with
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex gap-2">
              {(["all", "saved", "worked"] as const).map((tab) => (
                <Button
                  key={tab}
                  variant={crewTab === tab ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCrewTab(tab)}
                  className={crewTab === tab ? "bg-orange-500 hover:bg-orange-600" : ""}
                >
                  {tab === "all" ? "All" : tab === "saved" ? "Saved" : "Worked With"}
                </Button>
              ))}
            </div>
            <div className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, title, skills..."
                  value={crewSearch}
                  onChange={(e) => setCrewSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="relative flex-1 max-w-[200px]">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Location"
                  value={crewLocation}
                  onChange={(e) => setCrewLocation(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          {crewLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
          ) : crewFreelancers.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {crewTab === "saved" ? "No saved freelancers" : crewTab === "worked" ? "No freelancers worked with yet" : "No crew members yet"}
                </h3>
                <p className="text-muted-foreground max-w-md">
                  {crewTab === "saved"
                    ? "Save freelancers from the Find Crew page to build your crew list."
                    : crewTab === "worked"
                    ? "Hire freelancers through job postings to see them here."
                    : "Save or hire freelancers to build your crew."}
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setLocation("/freelancers")}
                >
                  <Search className="mr-2 h-4 w-4" />
                  Find Crew
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {crewFreelancers.map((freelancer: any) => (
                <Card
                  key={freelancer.user_id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setLocation(`/profile/${freelancer.user_id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {freelancer.profile_image_url ? (
                          <img
                            src={freelancer.profile_image_url}
                            alt={`${freelancer.first_name} ${freelancer.last_name}`}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                            <User className="h-6 w-6 text-orange-600" />
                          </div>
                        )}
                        <div>
                          <h3 className="font-semibold text-sm">
                            {freelancer.first_name} {freelancer.last_name}
                          </h3>
                          {freelancer.title && (
                            <p className="text-xs text-muted-foreground">{freelancer.title}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {freelancer.isSaved && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-orange-500"
                            onClick={(e) => {
                              e.stopPropagation();
                              unsaveCrewMutation.mutate(freelancer.user_id);
                            }}
                            title="Remove from saved"
                          >
                            <Bookmark className="h-4 w-4 fill-current" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {freelancer.location && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                        <MapPin className="h-3 w-3" />
                        {freelancer.location}
                      </div>
                    )}

                    {freelancer.average_rating > 0 && (
                      <div className="flex items-center gap-1 text-xs mb-2">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium">{Number(freelancer.average_rating).toFixed(1)}</span>
                      </div>
                    )}

                    {freelancer.skills && freelancer.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {freelancer.skills.slice(0, 4).map((skill: string, idx: number) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                        {freelancer.skills.length > 4 && (
                          <Badge variant="outline" className="text-xs">
                            +{freelancer.skills.length - 4}
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="flex gap-1 mt-2">
                      {freelancer.isSaved && (
                        <Badge className="bg-orange-100 text-orange-700 text-xs">Saved</Badge>
                      )}
                      {freelancer.isWorkedWith && (
                        <Badge className="bg-green-100 text-green-700 text-xs">Worked With</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Jobs Tab */}
        <TabsContent value="jobs" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">My Job Postings</h2>
              <p className="text-muted-foreground">
                Manage your job listings and track applications
              </p>
            </div>
            <Button onClick={() => setShowJobForm(!showJobForm)} data-testid="button-post-job">
              <Plus className="w-4 h-4 mr-2" />
              Post New Job
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title or location..."
                value={jobSearch}
                onChange={(e) => setJobSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {(["all", "active", "private", "closed"] as const).map((s) => (
                <Button
                  key={s}
                  variant={jobStatusFilter === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => setJobStatusFilter(s)}
                  className={jobStatusFilter === s ? "bg-orange-500 hover:bg-orange-600" : ""}
                >
                  {s === "all" ? "All" : s === "active" ? "Posted" : s === "private" ? "Unposted" : "Closed"}
                </Button>
              ))}
            </div>
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
            ) : (() => {
              const filteredJobs = myJobs.filter((job: Job) => {
                const searchLower = jobSearch.toLowerCase().trim();
                const matchesSearch = !searchLower || job.title.toLowerCase().includes(searchLower) || job.location.toLowerCase().includes(searchLower) || job.company.toLowerCase().includes(searchLower);
                const matchesStatus = jobStatusFilter === "all" || job.status === jobStatusFilter;
                return matchesSearch && matchesStatus;
              });
              return filteredJobs.length > 0 ? (
                filteredJobs.map((job: Job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    hiredApplicants={getHiredApplicantsForJob(job.id)}
                    applicantCount={getApplicantCountForJob(job.id)}
                    invitedCount={getInvitedCountForJob(job.id)}
                    onEdit={handleJobEdit}
                    onDelete={handleJobDelete}
                    onPublish={handlePublishJob}
                    onUnpublish={handleJobUnpublish}
                    onInvite={handleJobInvite}
                    onClose={handleJobClose}
                    onViewInvited={handleViewInvited}
                    onExpandToggle={toggleJobExpansion}
                    isExpanded={expandedJobs.has(job.id)}
                    showHiredSection={true}
                    currentUserId={user?.id || 0}
                  />
                ))
              ) : myJobs.length > 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Matching Jobs</h3>
                    <p className="text-muted-foreground">
                      Try adjusting your search or filters.
                    </p>
                  </CardContent>
                </Card>
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
              );
            })()}
          </div>
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages" className="space-y-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold">Messages</h2>
              <p className="text-muted-foreground">Create new connections and grow your network</p>
            </div>
          </div>
          <MessagingInterface initialConversationId={activeConversationId} />
        </TabsContent>

        {/* Applications Tab */}
        <TabsContent value="applications" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Applications</h2>
            <p className="text-muted-foreground">Review and manage job applications</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or job title..."
                value={appSearch}
                onChange={(e) => setAppSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {(["all", "applied", "invited", "hired", "rejected", "declined"] as const).map((s) => (
                <Button
                  key={s}
                  variant={appStatusFilter === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAppStatusFilter(s)}
                  className={appStatusFilter === s ? "bg-orange-500 hover:bg-orange-600" : ""}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {applicationsLoading ? (
            <div className="flex justify-center p-8">
              <div>Loading applications...</div>
            </div>
          ) : (() => {
            const filteredApps = applications.filter((app: JobApplication) => {
              const searchLower = appSearch.toLowerCase().trim();
              const freelancerName = `${app.freelancer_profile?.first_name || ""} ${app.freelancer_profile?.last_name || ""}`.toLowerCase();
              const matchesSearch = !searchLower || freelancerName.includes(searchLower) || (app.job_title || "").toLowerCase().includes(searchLower) || (app.job_company || "").toLowerCase().includes(searchLower);
              const matchesStatus = appStatusFilter === "all" || app.status === appStatusFilter;
              return matchesSearch && matchesStatus;
            });
            return filteredApps.length > 0 ? (
              <div className="space-y-4">
                {filteredApps.map((application: JobApplication) => (
                  <ApplicationCard
                    key={application.id}
                    application={application}
                    userType="recruiter"
                    currentUserId={user.id}
                  />
                ))}
              </div>
            ) : applications.length > 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Matching Applications</h3>
                  <p className="text-muted-foreground">
                    Try adjusting your search or filters.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Applications Yet</h3>
                  <p className="text-muted-foreground">
                    Job applications will appear here when freelancers apply to your posted jobs.
                  </p>
                </CardContent>
              </Card>
            );
          })()}
        </TabsContent>
      </Tabs>

      {/* Invite Modal */}
      {selectedJobForInvite && (
        <InviteFreelancerModal
          isOpen={inviteModalOpen}
          onClose={() => {
            setInviteModalOpen(false);
            setSelectedJobForInvite(null);
          }}
          jobId={selectedJobForInvite.id}
          jobTitle={selectedJobForInvite.title}
          alreadyInvitedIds={applications
            .filter((app: JobApplication) => app.job_id === selectedJobForInvite.id)
            .map((app: JobApplication) => app.freelancer_id)}
          existingApplications={applications
            .filter((app: JobApplication) => app.job_id === selectedJobForInvite.id)
            .map((app: JobApplication) => ({ freelancer_id: app.freelancer_id, status: app.status }))}
        />
      )}

      {/* View Invited Dialog */}
      {viewInvitedJob && (
        <InvitedFreelancersDialog
          isOpen={!!viewInvitedJob}
          onClose={() => setViewInvitedJob(null)}
          jobTitle={viewInvitedJob.title}
          invitedApplications={getInvitedApplicationsForJob(viewInvitedJob.id)}
        />
      )}
    </div>
  );
}
