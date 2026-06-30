import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabBadge } from "@/components/ui/tab-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MyJobs from "@/pages/freelancer/MyJobs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useIsPro } from "@/hooks/useIsPro";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { useFreelancerAverageRating } from "@/hooks/useRatings";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { FreelancerFormData, JobApplication } from "@shared/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Briefcase,
  Building2,
  CheckCircle,
  Check,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Mail,
  Play,
  Plus,
  QrCode,
  Send,
  Share2,
  ShieldCheck,
  Star,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import QRCode from "qrcode";
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
  const isPro = useIsPro();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get rating data for current user
  const { data: averageRating } = useFreelancerAverageRating(user?.id || 0);

  const [linkCopied, setLinkCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

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

  const [cardShareUrl, setCardShareUrl] = useState("");

  useEffect(() => {
    if (!showQrModal || !user) return;
    apiRequest("/api/freelancer/card-token")
      .then((data: { token: string }) => {
        const url = `${window.location.origin}/card/${user.id}?pt=${encodeURIComponent(data.token)}`;
        setCardShareUrl(url);
        return QRCode.toDataURL(url, { width: 256 });
      })
      .then(setQrDataUrl);
  }, [showQrModal, user]);

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
  useQuery({
    queryKey: ["/api/messages/unread-count", user?.id],
    queryFn: () => apiRequest(`/api/messages/unread-count?userId=${user?.id}`),
    refetchInterval: activeTab === "messages" ? 15000 : 30000, // Poll faster only when on messages tab
    refetchIntervalInBackground: false, // Stop when tab is inactive
    enabled: !!user?.id,
  });

  // Portfolio management
  interface PortfolioPost {
    id: number;
    user_id: number;
    type: "photo" | "video" | "blog" | "link";
    title: string | null;
    body: string | null;
    media_url: string | null;
    thumbnail_url: string | null;
    created_at: string;
  }
  const [viewingPost, setViewingPost] = useState<PortfolioPost | null>(null);
  const [showAddPost, setShowAddPost] = useState(false);
  const [addPostType, setAddPostType] = useState<"photo" | "video" | "link">("photo");
  const [addPostTitle, setAddPostTitle] = useState("");
  const [addPostBody, setAddPostBody] = useState("");
  const [addPostFile, setAddPostFile] = useState<File | null>(null);
  const [addPostUrl, setAddPostUrl] = useState("");
  const portfolioFileRef = useRef<HTMLInputElement>(null);
  const [thumbnailCandidates, setThumbnailCandidates] = useState<string[]>([]);
  const [selectedThumbnailIdx, setSelectedThumbnailIdx] = useState<number | null>(null);
  const [customThumbnailFile, setCustomThumbnailFile] = useState<File | null>(null);
  const [thumbnailsLoading, setThumbnailsLoading] = useState(false);
  const customThumbnailRef = useRef<HTMLInputElement>(null);
  // Step 2: thumbnail picker shown after video upload completes
  const [showThumbnailPicker, setShowThumbnailPicker] = useState(false);
  const [uploadedMediaUrl, setUploadedMediaUrl] = useState<string | null>(null);

  const generateVideoThumbnails = (file: File): Promise<string[]> => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;
      const url = URL.createObjectURL(file);
      video.src = url;

      const cleanup = () => URL.revokeObjectURL(url);

      const captureFrame = (): string => {
        const W = video.videoWidth || 640;
        const H = video.videoHeight || 360;
        // Cap at 640px wide to keep data URLs small
        const scale = Math.min(1, 640 / W);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(W * scale);
        canvas.height = Math.round(H * scale);
        canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/jpeg", 0.82);
      };

      video.onerror = () => {
        cleanup();
        resolve([]);
      };

      // Wait for enough data to seek
      video.onloadeddata = () => {
        const d = isFinite(video.duration) && video.duration > 0 ? video.duration : 10;
        const timestamps = [0.1, 0.3, 0.55, 0.75].map((p) =>
          Math.max(0.1, Math.min(d * p, d - 0.1))
        );
        const candidates: string[] = [];
        let idx = 0;

        const seekNext = () => {
          if (idx >= timestamps.length) {
            cleanup();
            resolve(candidates);
            return;
          }
          video.currentTime = timestamps[idx];
        };

        video.onseeked = () => {
          candidates.push(captureFrame());
          idx++;
          seekNext();
        };

        seekNext();
      };

      video.load();
    });
  };

  const { data: portfolioItems = [], refetch: refetchPortfolio } = useQuery<PortfolioPost[]>({
    queryKey: ["/api/portfolio", user?.id],
    queryFn: () => apiRequest(`/api/portfolio?userId=${user!.id}`),
    enabled: !!user?.id,
  });

  const uploadBlob = async (blob: Blob, filename: string): Promise<string> => {
    const formData = new FormData();
    formData.append("file", blob, filename);
    const token = localStorage.getItem("auth_token");
    const res = await fetch("/api/portfolio/upload", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) throw new Error("Upload failed");
    return (await res.json()).url;
  };

  const resetAddPost = () => {
    setShowAddPost(false);
    setShowThumbnailPicker(false);
    setAddPostTitle("");
    setAddPostBody("");
    setAddPostFile(null);
    setAddPostUrl("");
    setThumbnailCandidates([]);
    setSelectedThumbnailIdx(null);
    setCustomThumbnailFile(null);
    setUploadedMediaUrl(null);
  };

  // Step 1: upload the file and (for video) generate thumbnail candidates in parallel
  const addPortfolioMutation = useMutation({
    mutationFn: async () => {
      let media_url: string | null = null;
      if (addPostFile) {
        media_url = await uploadBlob(addPostFile, addPostFile.name);
      } else if (addPostUrl) {
        media_url = addPostUrl;
      }
      return { media_url };
    },
    onSuccess: async ({ media_url }) => {
      if (addPostType === "video" && addPostFile) {
        // Close step-1 dialog and open thumbnail picker
        setShowAddPost(false);
        setUploadedMediaUrl(media_url);
        setThumbnailsLoading(true);
        setShowThumbnailPicker(true);
        const candidates = await generateVideoThumbnails(addPostFile);
        setThumbnailCandidates(candidates);
        if (candidates.length > 0) setSelectedThumbnailIdx(0);
        setThumbnailsLoading(false);
      } else {
        // Non-video: create the post immediately, no thumbnail step
        await apiRequest("/api/portfolio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: addPostType,
            title: addPostTitle || null,
            body: addPostBody || null,
            media_url,
            thumbnail_url: null,
          }),
        });
        refetchPortfolio();
        resetAddPost();
        toast({ title: "Portfolio item added" });
      }
    },
    onError: () => toast({ title: "Upload failed", variant: "destructive" }),
  });

  // Step 2: save thumbnail choice and create the portfolio post
  const saveThumbnailMutation = useMutation({
    mutationFn: async () => {
      let thumbnail_url: string | null = null;
      if (customThumbnailFile) {
        thumbnail_url = await uploadBlob(customThumbnailFile, customThumbnailFile.name);
      } else if (selectedThumbnailIdx !== null && thumbnailCandidates[selectedThumbnailIdx]) {
        const dataUrl = thumbnailCandidates[selectedThumbnailIdx];
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        thumbnail_url = await uploadBlob(blob, "thumbnail.jpg");
      }
      return apiRequest("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: addPostType,
          title: addPostTitle || null,
          body: addPostBody || null,
          media_url: uploadedMediaUrl,
          thumbnail_url,
        }),
      });
    },
    onSuccess: () => {
      refetchPortfolio();
      resetAddPost();
      toast({ title: "Portfolio item added" });
    },
    onError: () => toast({ title: "Failed to save thumbnail", variant: "destructive" }),
  });

  const deletePortfolioMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/portfolio/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      refetchPortfolio();
      setViewingPost(null);
      toast({ title: "Deleted" });
    },
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

  const getProfileUrl = (includeToken = false) => {
    const base = window.location.origin;
    const slug = profile?.custom_slug || profile?.slug;
    const path = slug ? `${base}/profile/${slug}` : `${base}/profile/${user.id}`;
    if (includeToken && (profile as any)?.reference_token) {
      return `${path}?pt=${encodeURIComponent((profile as any).reference_token)}`;
    }
    return path;
  };

  const handleShareProfile = async () => {
    try {
      await navigator.clipboard.writeText(getProfileUrl(true));
      setLinkCopied(true);
      toast({ title: "Link copied!", description: "Your profile link is in the clipboard." });
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  // Simplified notification check
  return (
    <div className="container mx-auto min-w-0 max-w-full px-1 py-4 sm:px-6 sm:py-6">
      <div className="mb-4 px-3 sm:px-0">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold sm:text-3xl">Freelancer Dashboard</h1>
          {isPro ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-0.5 text-xs font-semibold text-white shadow">
              <Zap className="h-3 w-3 fill-white" /> Pro
            </span>
          ) : (
            <a
              href="/billing"
              className="inline-flex items-center gap-1 rounded-full border border-purple-300 px-3 py-0.5 text-xs font-medium text-purple-600 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-900/20"
            >
              <Zap className="h-3 w-3" /> Upgrade to Pro
            </a>
          )}
        </div>
        <p className="text-sm text-muted-foreground sm:text-base">
          Manage your profile, applications, and messages
        </p>
      </div>

      {/* Persistent share bar — Pro: purple gradient; Free: neutral */}
      {isPro ? (
        <div className="mb-4 flex flex-col gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 px-4 py-3 shadow-md sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
              Your public profile
            </p>
            <p className="truncate text-sm text-white/90">{getProfileUrl()}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              onClick={handleShareProfile}
              className="border-0 bg-white/20 text-white hover:bg-white/30"
            >
              {linkCopied ? (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy Link
                </>
              )}
            </Button>
            <Button size="sm" asChild className="border-0 bg-white/20 text-white hover:bg-white/30">
              <a href={getProfileUrl(true)} target="_blank" rel="noopener noreferrer">
                <Share2 className="mr-1.5 h-3.5 w-3.5" />
                View Profile
              </a>
            </Button>
            <Button
              size="sm"
              onClick={() => setShowQrModal(true)}
              className="border-0 bg-white/20 text-white hover:bg-white/30"
            >
              <QrCode className="mr-1.5 h-3.5 w-3.5" />
              QR Code
            </Button>
          </div>
        </div>
      ) : (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Your public profile
            </p>
            <p className="truncate text-sm text-muted-foreground">{getProfileUrl()}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="outline" onClick={handleShareProfile}>
              {linkCopied ? (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5 text-green-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy Link
                </>
              )}
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={getProfileUrl(true)} target="_blank" rel="noopener noreferrer">
                <Share2 className="mr-1.5 h-3.5 w-3.5" />
                View Profile
              </a>
            </Button>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-6">
          <TabsTrigger value="profile">Edit Profile</TabsTrigger>
          <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
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
                    phone: freelancerData.phone ?? null,
                    contact_email: freelancerData.contact_email ?? null,
                    card_dark_mode: freelancerData.card_dark_mode ?? false,
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

        {/* Portfolio Tab */}
        <TabsContent value="portfolio">
          {!isPro ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <p className="text-sm font-medium">Portfolio is a Pro feature.</p>
              <p className="text-xs">Upgrade your account to add and showcase your work.</p>
            </div>
          ) : (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {portfolioItems.length} item{portfolioItems.length !== 1 ? "s" : ""}
                </p>
                <Button size="sm" onClick={() => setShowAddPost(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </div>

              {portfolioItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-16 text-muted-foreground">
                  <p className="text-sm">No portfolio items yet. Add your first item above.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-0.5">
                  {portfolioItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setViewingPost(item)}
                      className="group relative aspect-square overflow-hidden border border-border/40 bg-white transition-opacity hover:opacity-90"
                    >
                      {item.type === "photo" && item.media_url && (
                        <img
                          src={item.media_url}
                          alt={item.title || ""}
                          className="h-full w-full object-cover"
                        />
                      )}
                      {item.type === "video" && (
                        <>
                          {item.thumbnail_url && (
                            <img
                              src={item.thumbnail_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          )}
                          <div
                            className={cn(
                              "absolute inset-0 flex items-center justify-center",
                              !item.thumbnail_url && "bg-white"
                            )}
                          >
                            <Play className="h-8 w-8 text-primary drop-shadow-lg" />
                          </div>
                        </>
                      )}
                      {item.type === "link" && (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-primary/5 p-3">
                          <ExternalLink className="h-7 w-7 text-primary" />
                          {item.title && (
                            <p className="line-clamp-2 text-center text-xs font-medium">
                              {item.title}
                            </p>
                          )}
                        </div>
                      )}
                      {item.type === "blog" && (
                        <div className="flex h-full w-full items-center justify-center bg-white p-3">
                          <p className="line-clamp-4 text-center text-xs text-muted-foreground">
                            {item.title || item.body}
                          </p>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
                    </button>
                  ))}
                </div>
              )}

              {/* Step 1: Add portfolio item */}
              <Dialog open={showAddPost} onOpenChange={(open) => !open && resetAddPost()}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Portfolio Item</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="flex gap-2">
                      {(["photo", "video", "link"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => {
                            setAddPostType(t);
                            setAddPostFile(null);
                            setAddPostUrl("");
                          }}
                          className={cn(
                            "flex-1 rounded-md border py-2 text-sm font-medium capitalize transition-colors",
                            addPostType === t
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    {(addPostType === "photo" || addPostType === "video") && (
                      <div>
                        <input
                          ref={portfolioFileRef}
                          type="file"
                          accept={
                            addPostType === "photo"
                              ? "image/jpeg,image/png,image/gif,image/webp"
                              : "video/mp4,video/quicktime,video/webm,video/x-msvideo,video/avi"
                          }
                          className="hidden"
                          onChange={(e) => setAddPostFile(e.target.files?.[0] ?? null)}
                        />
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => portfolioFileRef.current?.click()}
                        >
                          {addPostFile ? addPostFile.name : `Choose ${addPostType} file`}
                        </Button>
                      </div>
                    )}
                    {addPostType === "link" && (
                      <Input
                        placeholder="https://..."
                        value={addPostUrl}
                        onChange={(e) => setAddPostUrl(e.target.value)}
                      />
                    )}
                    <Input
                      placeholder="Title (optional)"
                      value={addPostTitle}
                      onChange={(e) => setAddPostTitle(e.target.value)}
                    />
                    <Input
                      placeholder="Description (optional)"
                      value={addPostBody}
                      onChange={(e) => setAddPostBody(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={resetAddPost}>
                      Cancel
                    </Button>
                    <Button
                      onClick={() => addPortfolioMutation.mutate()}
                      disabled={
                        addPortfolioMutation.isPending ||
                        (addPostType !== "link" && !addPostFile) ||
                        (addPostType === "link" && !addPostUrl)
                      }
                    >
                      {addPortfolioMutation.isPending ? "Uploading…" : "Upload"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Step 2: Choose cover image (video only) */}
              <Dialog open={showThumbnailPicker} onOpenChange={(open) => !open && resetAddPost()}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Choose a cover image</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    {thumbnailsLoading && (
                      <p className="text-center text-sm text-muted-foreground">
                        Generating previews…
                      </p>
                    )}
                    {!thumbnailsLoading && thumbnailCandidates.length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {thumbnailCandidates.map((src, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              setSelectedThumbnailIdx(i);
                              setCustomThumbnailFile(null);
                            }}
                            className={cn(
                              "aspect-video overflow-hidden rounded border-2 transition-colors",
                              selectedThumbnailIdx === i && !customThumbnailFile
                                ? "border-primary"
                                : "border-border"
                            )}
                          >
                            <img
                              src={src}
                              alt={`Frame ${i + 1}`}
                              className="h-full w-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                    <input
                      ref={customThumbnailRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        setCustomThumbnailFile(f);
                        if (f) setSelectedThumbnailIdx(null);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => customThumbnailRef.current?.click()}
                      className={cn(
                        "w-full rounded border-2 border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary",
                        customThumbnailFile ? "border-primary text-primary" : "border-border"
                      )}
                    >
                      {customThumbnailFile
                        ? `Custom: ${customThumbnailFile.name}`
                        : "Upload custom cover image"}
                    </button>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      disabled={saveThumbnailMutation.isPending}
                      onClick={async () => {
                        // Skip thumbnail — save post with no cover
                        await apiRequest("/api/portfolio", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            type: addPostType,
                            title: addPostTitle || null,
                            body: addPostBody || null,
                            media_url: uploadedMediaUrl,
                            thumbnail_url: null,
                          }),
                        });
                        refetchPortfolio();
                        resetAddPost();
                        toast({ title: "Portfolio item added" });
                      }}
                    >
                      Skip
                    </Button>
                    <Button
                      onClick={() => saveThumbnailMutation.mutate()}
                      disabled={
                        saveThumbnailMutation.isPending ||
                        thumbnailsLoading ||
                        (selectedThumbnailIdx === null && !customThumbnailFile)
                      }
                    >
                      {saveThumbnailMutation.isPending ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* View/delete item dialog */}
              {viewingPost && (
                <Dialog open={!!viewingPost} onOpenChange={(open) => !open && setViewingPost(null)}>
                  <DialogContent className="max-w-2xl overflow-hidden p-0">
                    <div className="relative">
                      {viewingPost.type === "photo" && viewingPost.media_url && (
                        <img
                          src={viewingPost.media_url}
                          alt={viewingPost.title || ""}
                          className="max-h-[70vh] w-full bg-white object-contain"
                        />
                      )}
                      {viewingPost.type === "video" && viewingPost.media_url && (
                        <video
                          src={viewingPost.media_url}
                          controls
                          className="max-h-[70vh] w-full bg-white"
                        />
                      )}
                      {viewingPost.type === "link" && (
                        <div className="flex flex-col items-center justify-center gap-4 bg-white p-12">
                          <ExternalLink className="h-12 w-12 text-primary" />
                          <a
                            href={viewingPost.media_url || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="break-all text-center text-primary hover:underline"
                          >
                            {viewingPost.media_url}
                          </a>
                        </div>
                      )}
                    </div>
                    {(viewingPost.title || viewingPost.body) && (
                      <div className="space-y-1 p-4">
                        {viewingPost.title && <p className="font-semibold">{viewingPost.title}</p>}
                        {viewingPost.body && (
                          <p className="text-sm text-muted-foreground">{viewingPost.body}</p>
                        )}
                      </div>
                    )}
                    <div className="flex justify-end px-4 pb-4">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deletePortfolioMutation.mutate(viewingPost.id)}
                        disabled={deletePortfolioMutation.isPending}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          )}
        </TabsContent>

        {/* References Tab */}
        <TabsContent value="references" className="space-y-6">
          <ReferenceRequestsSection userId={user.id} />
        </TabsContent>
      </Tabs>

      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-purple-600" />
              Scan to view profile
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrDataUrl ? (
              <a
                href={cardShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Click to open card"
              >
                <img
                  src={qrDataUrl}
                  alt="Profile QR code"
                  className="h-56 w-56 cursor-pointer rounded-lg transition-opacity hover:opacity-80"
                />
              </a>
            ) : (
              <div className="flex h-56 w-56 items-center justify-center rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Generating...</p>
              </div>
            )}
            <p className="max-w-[220px] break-all text-center text-xs text-muted-foreground">
              {cardShareUrl}
            </p>
            {qrDataUrl && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = qrDataUrl;
                  a.download = "eventlink-qr-code.png";
                  a.click();
                }}
              >
                <Download className="h-4 w-4" />
                Download QR Code
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
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
                            &ldquo;{ref.comment}&rdquo;
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
