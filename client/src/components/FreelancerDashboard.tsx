import { Card, CardContent } from "@/components/ui/card";
import { TabBadge } from "@/components/ui/tab-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { useFreelancerAverageRating } from "@/hooks/useRatings";
import { apiRequest } from "@/lib/queryClient";
import type { FreelancerFormData, JobApplication } from "@shared/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, BookOpen, Briefcase, CheckCircle, Clock, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ApplicationCard } from "./ApplicationCard";
import { DocumentUploader } from "./DocumentUploader";
import { MessagingInterface } from "./MessagingInterface";
import { ProfileForm } from "./ProfileForm";

export default function SimplifiedFreelancerDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get rating data for current user
  const { data: averageRating } = useFreelancerAverageRating(user?.id || 0);

  // Check URL parameters for initial tab and react to location changes
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState(() => {
    const search = location.includes("?")
      ? location.split("?")[1]
      : window.location.search.replace(/^\?/, "");
    const urlParams = new URLSearchParams(search);
    const tabParam = urlParams.get("tab");
    return tabParam || "profile";
  });

  // Track active conversation ID from URL
  const [activeConversationId, setActiveConversationId] = useState<number | null>(() => {
    const search = location.includes("?")
      ? location.split("?")[1]
      : window.location.search.replace(/^\?/, "");
    const urlParams = new URLSearchParams(search);
    const convParam =
      urlParams.get("conversation") ||
      urlParams.get("conversationId") ||
      urlParams.get("recipientId");
    return convParam ? parseInt(convParam, 10) : null;
  });

  // Handle URL parameter changes (e.g., from notifications)
  useEffect(() => {
    const handleSearchParams = () => {
      const search = window.location.search.replace(/^\?/, "");
      const urlParams = new URLSearchParams(search);
      const tabParam = urlParams.get("tab");
      if (tabParam && tabParam !== activeTab) {
        setActiveTab(tabParam);
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

  // Get badge counts for tabs
  const { roleSpecificCounts, markCategoryAsRead } = useBadgeCounts({
    enabled: !!user?.id,
    refetchInterval: activeTab === "messages" ? 1000 : 1500, // Poll faster when on messages tab
  });

  // Fetch freelancer profile data
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["/api/freelancer/profile", user?.id],
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
    queryKey: ["/api/freelancer/applications", user?.id],
    queryFn: async () => {
      return await apiRequest(`/api/freelancer/${user?.id}/applications`);
    },
    retry: false,
    enabled: !!user?.id,
  });

  // Fetch unread message count with optimized polling
  const { data: unreadCount } = useQuery({
    queryKey: ["/api/messages/unread-count", user?.id],
    queryFn: () => apiRequest(`/api/messages/unread-count?userId=${user?.id}`),
    refetchInterval: activeTab === "messages" ? 15000 : 30000, // Poll faster only when on messages tab
    refetchIntervalInBackground: false, // Stop when tab is inactive
    enabled: !!user?.id,
  });

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
    // Note: Messages notifications are NOT marked as read automatically
    // They remain unread until user explicitly views/reads them
    if (tab === "jobs") {
      markCategoryAsRead("applications");
    } else if (tab === "bookings") {
      markCategoryAsRead("ratings");
    }
    // Removed: markCategoryAsRead('messages') - keep message notifications unread until user reads them
  };

  if (!user) {
    return <div>Please log in to access the dashboard.</div>;
  }

  // Simplified notification check
  const hasNewJobUpdates = false;

  return (
    <div className="[dden container mx-auto px-1 py-4 sm:px-6 sm:py-6">
      <div className="sm mb-4 px-3 sm:px-0">
        <h1 className="text-2xl font-bold sm:text-3xl">Freelancer Dashboard</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Manage your profile, applications, and messages
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Edit Profile</TabsTrigger>
          <TabsTrigger value="jobs" className="gap-2">
            My Applications
            <TabBadge count={roleSpecificCounts.applications || 0} />
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-2">
            Messages
            <TabBadge count={roleSpecificCounts.messages || 0} />
          </TabsTrigger>
          <TabsTrigger value="bookings" className="gap-2">
            Pending Ratings
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
                  console.log("🚀 SAVE CLICKED! Saving freelancer profile data:", formData);

                  // Use the correct API endpoint for freelancer profiles
                  // Build update data excluding CV fields (managed separately by CV upload/delete)
                  const freelancerData = formData as FreelancerFormData;

                  const processedData: any = {
                    user_id: user.id,
                    first_name: freelancerData.first_name,
                    last_name: freelancerData.last_name,
                    title: freelancerData.title,
                    bio: freelancerData.bio,
                    superpower: freelancerData.superpower,
                    location: freelancerData.location,
                    skills: freelancerData.skills,
                    portfolio_url: freelancerData.portfolio_url,
                    linkedin_url: freelancerData.linkedin_url,
                    website_url: freelancerData.website_url,
                    availability_status: freelancerData.availability_status,
                    profile_photo_url: freelancerData.profile_photo_url,
                    experience_years: freelancerData.experience_years
                      ? parseInt(freelancerData.experience_years.toString())
                      : undefined,
                  };
                  console.log("📤 Sending processed data (CV fields excluded):", processedData);

                  const savedProfile = await apiRequest(`/api/freelancer/${user.id}`, {
                    method: "PUT",
                    body: JSON.stringify(processedData),
                  });
                  console.log("✅ Profile saved successfully:", savedProfile);

                  // Force refetch to update UI with saved data
                  console.log("🔄 Forcing refetch for user:", user?.id);
                  await queryClient.refetchQueries({
                    queryKey: ["/api/freelancer/profile", user?.id],
                    exact: true,
                    type: "active",
                  });
                  console.log("🔄 Profile refetched with saved data!");

                  // Show success message with toast
                  toast({
                    title: "Profile saved successfully!",
                    description: "Your changes have been updated.",
                  });
                } catch (error) {
                  console.error("Error saving profile:", error);
                  toast({
                    title: "Failed to save profile",
                    description: `${error instanceof Error ? error.message : "Unknown error"}. Please try again.`,
                    variant: "destructive",
                  });
                }
              }}
              isSaving={false}
            />
          )}

          {/* Documents & Certifications Section */}
          {user?.id && (
            <div className="mt-6">
              <DocumentUploader userId={user.id} isOwner={true} viewerRole="freelancer" />
            </div>
          )}
        </TabsContent>

        {/* Jobs/Applications Tab */}
        <TabsContent value="jobs" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">My Job Applications</h2>
            <p className="text-muted-foreground">Track your application status and responses</p>
          </div>

          {/* Application Status Summary - Always show if there are applications */}
          {!applicationsLoading && jobApplications.length > 0 && (
            <Card data-testid="card-application-summary">
              <CardContent className="p-6">
                <h3 className="mb-4 font-medium">Application Summary</h3>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                  <div className="text-center">
                    <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/20">
                      <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div className="text-2xl font-bold">
                      {
                        jobApplications.filter((app: JobApplication) => app.status === "applied")
                          .length
                      }
                    </div>
                    <div className="text-sm text-muted-foreground">Pending</div>
                  </div>
                  <div className="text-center">
                    <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
                      <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="text-2xl font-bold">
                      {
                        jobApplications.filter((app: JobApplication) => app.status === "reviewed")
                          .length
                      }
                    </div>
                    <div className="text-sm text-muted-foreground">Reviewed</div>
                  </div>
                  <div className="text-center">
                    <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {
                        jobApplications.filter((app: JobApplication) => app.status === "hired")
                          .length
                      }
                    </div>
                    <div className="text-sm text-muted-foreground">Hired</div>
                  </div>
                  <div className="text-center">
                    <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                      <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="text-2xl font-bold">
                      {
                        jobApplications.filter((app: JobApplication) => app.status === "rejected")
                          .length
                      }
                    </div>
                    <div className="text-sm text-muted-foreground">Rejected</div>
                  </div>
                  <div className="text-center">
                    <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/20">
                      <Star className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div className="text-2xl font-bold">{averageRating?.count || 0}</div>
                    <div className="text-sm text-muted-foreground">Ratings</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Applications List */}
          {applicationsLoading ? (
            <div className="flex justify-center p-8">Loading applications...</div>
          ) : jobApplications.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Briefcase className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-medium">No Applications Yet</h3>
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
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages" className="space-y-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Messages</h2>
              <p className="text-muted-foreground">Create new connections and grow your network</p>
            </div>
          </div>
          {user && <MessagingInterface initialConversationId={activeConversationId} />}
        </TabsContent>

        {/* Bookings Tab */}
        <TabsContent value="bookings" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">My Bookings</h2>
            <p className="text-muted-foreground">Manage your confirmed job bookings and schedule</p>
          </div>

          {applicationsLoading ? (
            <div className="flex justify-center p-8">Loading bookings...</div>
          ) : jobApplications.filter((app: JobApplication) => app.status === "hired").length ===
            0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <BookOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-medium">No Bookings Yet</h3>
                <p className="text-muted-foreground">
                  When you get hired for jobs, they will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {jobApplications
                .filter((application: JobApplication) => application.status === "hired")
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
