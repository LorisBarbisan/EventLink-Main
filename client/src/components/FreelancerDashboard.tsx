import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabBadge } from "@/components/ui/tab-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MyJobs from "@/pages/freelancer/MyJobs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { useFreelancerAverageRating } from "@/hooks/useRatings";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import type { FreelancerFormData, JobApplication } from "@shared/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Briefcase,
  Building2,
  CheckCircle,
  Clock,
  Mail,
  Send,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ApplicationCard } from "./ApplicationCard";
import { DocumentUploader } from "./DocumentUploader";
import { MessagingInterface } from "./MessagingInterface";
import { ProfileForm } from "./ProfileForm";
import { BADGE_CONFIG, VerificationBadge } from "./ReferenceBadges";

const RATING_LABELS: Record<string, { label: string; stars: number }> = {
  excellent: { label: "Excellent", stars: 5 },
  good: { label: "Good", stars: 4 },
  mixed: { label: "Mixed", stars: 3 },
};

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
  // profileHasEverLoaded prevents "Loading profile..." from re-appearing during
  // re-fetches after invalidation, which would cause ProfileForm/CVParsingReview
  // to unmount/remount and trigger an infinite toast/request loop for new users.
  const profileHasEverLoaded = useRef(false);
  const { data: profile, isLoading: profileQueryLoading } = useQuery({
    queryKey: ["/api/freelancer/profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const data = await apiRequest(`/api/freelancer/${user.id}`);
      return data;
    },
    retry: false,
    enabled: !!user?.id,
  });
  if (!profileQueryLoading) profileHasEverLoaded.current = true;
  const profileLoading = profileQueryLoading && !profileHasEverLoaded.current;

  // Get user's job applications
  const { data: jobApplications = [], isLoading: applicationsLoading } = useQuery({
    queryKey: ["/api/freelancer/applications", user?.id],
    queryFn: async () => {
      return await apiRequest(`/api/freelancer/${user?.id}/applications`);
    },
    retry: false,
    enabled: !!user?.id,
  });

  useQuery({
    queryKey: ["/api/messages/unread-count", user?.id],
    queryFn: () => apiRequest(`/api/messages/unread-count?userId=${user?.id}`),
    refetchInterval: activeTab === "messages" ? 15000 : 30000,
    refetchIntervalInBackground: false,
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

  return (
    <div className="container mx-auto min-w-0 max-w-full px-1 py-4 sm:px-6 sm:py-6">
      <div className="mb-4 px-3 sm:px-0">
        <h1 className="text-2xl font-bold sm:text-3xl">Freelancer Dashboard</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Manage your profile, applications, and messages
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-5">
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
          <TabsTrigger value="references" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            References
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
                    <div className="text-sm text-muted-foreground">Declined</div>
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
          <MyJobs />
        </TabsContent>

        {/* References Tab */}
        <TabsContent value="references" className="space-y-6">
          <ReferenceRequestsSection userId={user.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReferenceRequestsSection({ userId }: { userId: number }) {
  const { toast } = useToast();
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");

  const { data: referenceData, isLoading } = useQuery<{
    requests: any[];
    summary: { total: number; completed: number; pending: number };
  }>({
    queryKey: ["/api/references/requests"],
  });

  const { data: tokenData } = useQuery<{ token: string; url: string }>({
    queryKey: ["/api/references/my-token"],
  });

  const createRequestMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/references/requests", {
        method: "POST",
        body: JSON.stringify({
          referee_email: newEmail.trim(),
          referee_name: newName.trim() || null,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: "Request sent", description: "Reference request email has been sent." });
      setNewEmail("");
      setNewName("");
      qc.invalidateQueries({ queryKey: ["/api/references/requests"] });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "Failed to send request",
        variant: "destructive",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/references/requests/${id}/cancel`, { method: "PATCH" });
    },
    onSuccess: () => {
      toast({ title: "Cancelled", description: "Reference request has been cancelled." });
      qc.invalidateQueries({ queryKey: ["/api/references/requests"] });
    },
  });

  const reminderMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/references/requests/${id}/remind`, { method: "POST" });
    },
    onSuccess: () => {
      toast({ title: "Reminder sent", description: "A polite reminder has been sent." });
      qc.invalidateQueries({ queryKey: ["/api/references/requests"] });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "Could not send reminder",
        variant: "destructive",
      });
    },
  });

  const { data: receivedRefs = [] } = useQuery<any[]>({
    queryKey: ["/api/references/freelancer", userId],
    queryFn: async () => {
      const res = await fetch(`/api/references/freelancer/${userId}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!userId,
  });

  const summary = referenceData?.summary || { total: 0, completed: 0, pending: 0 };
  const requests = referenceData?.requests || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">My References</h2>
        <p className="text-muted-foreground">
          Request and track professional references from past employers
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{summary.total}</div>
            <div className="text-sm text-muted-foreground">Requests Sent</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{summary.completed}</div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{summary.pending}</div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Send className="h-5 w-5" />
            Send Reference Request
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <Label className="text-sm">
                Referee&apos;s email <span className="text-red-500">*</span>
              </Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="e.g. manager@company.com"
              />
            </div>
            <div>
              <Label className="text-sm">
                Referee&apos;s name <span className="text-xs text-gray-400">(Optional)</span>
              </Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Sarah Johnson"
              />
            </div>
            <Button
              onClick={() => createRequestMutation.mutate()}
              disabled={!newEmail.trim() || createRequestMutation.isPending}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600"
            >
              {createRequestMutation.isPending ? "Sending..." : "Send Reference Request"}
            </Button>
          </div>

          {tokenData?.url && (
            <div className="mt-4 border-t pt-4">
              <p className="mb-2 text-xs text-muted-foreground">
                Or share your reference link directly:
              </p>
              <div className="flex gap-2">
                <Input readOnly value={tokenData.url} className="text-xs" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(tokenData.url);
                    toast({ title: "Copied!", description: "Reference link copied to clipboard." });
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="p-4 text-center text-muted-foreground">Loading requests...</div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Mail className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-medium">No Reference Requests Yet</h3>
            <p className="text-muted-foreground">
              Send reference requests to previous employers to build your professional reputation.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req: any) => (
            <Card key={req.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{req.referee_name || req.referee_email}</p>
                      {req.status === "completed" && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-green-300 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          <CheckCircle className="h-3 w-3" /> Completed
                        </span>
                      )}
                      {req.status === "pending" && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          <Clock className="h-3 w-3" /> Pending
                        </span>
                      )}
                      {req.status === "cancelled" && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                          <X className="h-3 w-3" /> Cancelled
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{req.referee_email}</p>
                    {req.reminder_sent && (
                      <p className="mt-0.5 text-xs text-muted-foreground">Reminder sent</p>
                    )}
                  </div>
                  {req.status === "pending" && (
                    <div className="flex gap-2">
                      {!req.reminder_sent && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => reminderMutation.mutate(req.id)}
                          disabled={reminderMutation.isPending}
                        >
                          Remind
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelMutation.mutate(req.id)}
                        disabled={cancelMutation.isPending}
                        className="text-red-500 hover:text-red-600"
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="border-t pt-4">
        <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="h-5 w-5 text-green-600" />
          Received References
        </h3>
        {receivedRefs.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No references received yet. Send requests above to start building your reputation.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {receivedRefs.map((ref: any) => {
              const badge = BADGE_CONFIG[ref.badge_result];
              const rating = RATING_LABELS[ref.q2_rating];
              return (
                <Card key={ref.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {ref.referee_organisation && (
                            <span className="flex items-center gap-1 text-sm font-medium">
                              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                              {ref.referee_organisation}
                            </span>
                          )}
                          {ref.referee_name && (
                            <span className="text-xs text-muted-foreground">
                              — {ref.referee_name}
                            </span>
                          )}
                        </div>
                        {ref.comment && (
                          <p className="mt-1 line-clamp-2 text-sm italic text-muted-foreground">
                            &quot;{ref.comment}&quot;
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {badge && (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${badge.colour}`}
                            >
                              {badge.icon} {badge.label}
                            </span>
                          )}
                          <VerificationBadge reference={ref} />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        {rating && (
                          <div className="flex items-center gap-1">
                            {Array.from({ length: rating.stars }).map((_, i) => (
                              <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            ))}
                            {Array.from({ length: 5 - rating.stars }).map((_, i) => (
                              <Star key={i} className="h-3.5 w-3.5 text-gray-200" />
                            ))}
                          </div>
                        )}
                        {ref.created_at && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {new Date(ref.created_at).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
