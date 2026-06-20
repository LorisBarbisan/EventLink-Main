import { DocumentUploader } from "@/components/DocumentUploader";
import { ProfileQRCode } from "@/components/ProfileQRCode";
import { VanityUrlEditor } from "@/components/VanityUrlEditor";
import { InviteClientsDialog } from "@/components/InviteClientsDialog";
import { Layout } from "@/components/Layout";
import { MessageModal } from "@/components/MessageModal";
import {
  BADGE_CONFIG,
  VerificationBadge,
  DomainTrustIndicator,
  ReferenceBadges,
} from "@/components/ReferenceBadges";
import { StandaloneRatingDialog } from "@/components/StandaloneRatingDialog";
import { RatingDisplay, StarRating } from "@/components/StarRating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { FreelancerPortfolio } from "@/components/FreelancerPortfolio";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  useFreelancerAverageRating,
  useFreelancerRatings,
  useReportRating,
} from "@/hooks/useRatings";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Bookmark,
  Briefcase,
  Calendar,
  Check,
  Copy,
  Download,
  ExternalLink,
  Flag,
  Globe,
  Linkedin,
  MapPin,
  MessageCircle,
  Quote,
  Share2,
  ShieldCheck,
  Star,
  User,
  AlertTriangle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";

const EVENTLINK_PROMOTIONAL_EMAIL = "eventlink@eventlink.one";

interface Profile {
  id: string;
  role: "freelancer" | "recruiter" | "admin";
  email: string;
}

interface FreelancerProfile {
  id?: string;
  user_id: number;
  first_name: string;
  last_name: string;
  title: string;
  bio: string;
  superpower: string;
  location: string;
  experience_years: number | null;
  skills: string[];
  portfolio_url: string;
  linkedin_url: string;
  website_url: string;
  availability_status: "available" | "busy" | "unavailable";
  profile_photo_url?: string;
  slug?: string | null;
  custom_slug?: string | null;
  reference_token?: string | null;
  cv_file_url?: string;
  cv_file_name?: string;
  cv_file_type?: string;
  cv_file_size?: number;
}

interface RecruiterProfile {
  id?: string;
  company_name: string;
  contact_name: string;
  company_type: string;
  description: string;
  location: string;
  website_url: string;
  linkedin_url: string;
  company_logo_url?: string;
}

function ReviewsSection({ freelancerId }: { freelancerId: number }) {
  const { data: ratings = [] } = useFreelancerRatings(freelancerId);
  const reviews = ratings.filter((r: any) => r.review);
  const { mutate: reportRating, isPending: isReporting } = useReportRating();

  const [reportOpen, setReportOpen] = useState(false);
  const [selectedRatingId, setSelectedRatingId] = useState<number | null>(null);
  const [reportFlag, setReportFlag] = useState("");
  const [reportNote, setReportNote] = useState("");

  const handleReportClick = (ratingId: number) => {
    setSelectedRatingId(ratingId);
    setReportFlag("");
    setReportNote("");
    setReportOpen(true);
  };

  const submitReport = () => {
    if (selectedRatingId && reportFlag) {
      const fullReason = reportNote ? `${reportFlag}: ${reportNote}` : reportFlag;
      reportRating(
        { ratingId: selectedRatingId, reason: fullReason },
        {
          onSuccess: () => {
            setReportOpen(false);
          },
        }
      );
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {reviews.map((rating: any, index: number) => (
              <div key={rating.id}>
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          {rating.recruiter?.first_name || "Employer"}{" "}
                          {rating.recruiter?.last_name || ""}
                        </span>
                        <span className="text-sm text-muted-foreground">•</span>
                        <StarRating rating={rating.rating} readonly size="sm" />
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleReportClick(rating.id)}
                        title="Report review"
                      >
                        <Flag className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="mb-2 text-sm italic text-muted-foreground">
                      {" "}
                      &quot;{rating.review}&quot;
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {rating.job_title && <span>Project: {rating.job_title} • </span>}
                      {format(new Date(rating.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
                {index < reviews.length - 1 && <Separator className="mt-6" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Review</DialogTitle>
            <DialogDescription>
              Please provide a reason for reporting this review. We investigate all reports.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="flag-reason">Reason</Label>
              <Select value={reportFlag} onValueChange={setReportFlag}>
                <SelectTrigger id="flag-reason">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spam">Spam</SelectItem>
                  <SelectItem value="harassment">Harassment</SelectItem>
                  <SelectItem value="abusive_language">Abusive Language</SelectItem>
                  <SelectItem value="profanity">Profanity</SelectItem>
                  <SelectItem value="fake_review">Fake Review</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="note">Note</Label>
              <Textarea
                id="note"
                placeholder="Add additional details..."
                value={reportNote}
                onChange={(e: any) => setReportNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitReport}
              disabled={!reportFlag || isReporting}
              variant="destructive"
            >
              {isReporting ? "Submitting..." : "Submit Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReferencesSection({
  freelancerId,
  currentUser,
}: {
  freelancerId: number;
  currentUser?: any;
}) {
  const { data: references = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/references/freelancer/${freelancerId}`],
    enabled: !!freelancerId,
    throwOnError: false,
    retry: 1,
  });
  const { toast } = useToast();
  const [reportingRefId, setReportingRefId] = useState<number | null>(null);
  const [reportReason, setReportReason] = useState("");

  const reportMutation = useMutation({
    mutationFn: async (refId: number) => {
      return apiRequest(`/api/references/report/${refId}`, {
        method: "POST",
        body: JSON.stringify({ reason: reportReason.trim() || null }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Report submitted",
        description: "Thank you. This reference has been flagged for review.",
      });
      setReportingRefId(null);
      setReportReason("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit report. Please try again.",
        variant: "destructive",
      });
    },
  });

  const withComments = references.filter((r: any) => r.comment);
  const isEmployer = currentUser?.role === "recruiter" || currentUser?.role === "admin";

  if (isLoading || references.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-blue-600" />
          References
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap gap-2">
          {(["highly_recommended", "recommended", "work_history_confirmed"] as const).map(
            (badge) => {
              const count = references.filter((r: any) => r.badge_result === badge).length;
              if (!count) return null;
              const cfg = BADGE_CONFIG[badge];
              return (
                <span
                  key={badge}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${cfg.colour}`}
                >
                  {cfg.icon} {cfg.label} · {count}
                </span>
              );
            }
          )}
        </div>

        {withComments.length > 0 && (
          <div className="space-y-4">
            {withComments.map((ref: any, i: number) => (
              <div key={ref.id}>
                <div className="flex items-start gap-3">
                  <Quote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm italic text-muted-foreground">
                      &ldquo;{ref.comment}&rdquo;
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {(ref.referee_name || ref.referee_organisation) && (
                        <p className="text-xs text-muted-foreground">
                          — {ref.referee_name || ""}
                          {ref.referee_role ? `, ${ref.referee_role}` : ""}
                          {ref.referee_organisation ? ` at ${ref.referee_organisation}` : ""}
                        </p>
                      )}
                      <VerificationBadge reference={ref} />
                      <DomainTrustIndicator level={ref.domain_trust_level} />
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(ref.created_at), "MMM yyyy")}
                      </p>
                      {isEmployer && (
                        <button
                          onClick={() => setReportingRefId(ref.id)}
                          className="flex items-center gap-0.5 text-xs text-gray-400 transition-colors hover:text-red-500"
                          title="Report suspicious reference"
                        >
                          <Flag className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {i < withComments.length - 1 && <Separator className="mt-4" />}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog
        open={reportingRefId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setReportingRefId(null);
            setReportReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Report Suspicious Reference
            </DialogTitle>
            <DialogDescription>
              Flag this reference privately for the platform moderation team to review.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-1 block text-sm text-gray-600">
                Reason <span className="text-xs text-gray-400">(Optional)</span>
              </Label>
              <Textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Why do you believe this reference is suspicious?"
                className="resize-none"
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setReportingRefId(null);
                setReportReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => reportingRefId && reportMutation.mutate(reportingRefId)}
              disabled={reportMutation.isPending}
            >
              {reportMutation.isPending ? "Submitting..." : "Submit Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function Profile() {
  const [, setLocation] = useLocation();
  const { userId } = useParams();
  const publicToken = new URLSearchParams(window.location.search).get("pt") ?? undefined;
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [freelancerProfile, setFreelancerProfile] = useState<FreelancerProfile | null>(null);
  const [recruiterProfile, setRecruiterProfile] = useState<RecruiterProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [profileDataLoaded, setProfileDataLoaded] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const { toast } = useToast();

  const getProfileUrl = (includeToken = false) => {
    const base = window.location.origin;
    const slug = freelancerProfile?.custom_slug || freelancerProfile?.slug;
    const path = slug
      ? `${base}/profile/${slug}`
      : `${base}/profile/${freelancerProfile?.user_id ?? ""}`;
    if (includeToken && freelancerProfile?.reference_token) {
      return `${path}?pt=${encodeURIComponent(freelancerProfile.reference_token)}`;
    }
    return path;
  };

  const handleShareProfile = async () => {
    const url = getProfileUrl(true); // include ?pt= token for own profile
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      toast({ title: "Link copied!", description: "Profile link copied to clipboard." });
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast({
        title: "Copy failed",
        description: "Please copy the URL from your browser.",
        variant: "destructive",
      });
    }
  };

  const isRecruiter = user?.role === "recruiter" || user?.role === "admin";
  const profileUserId = userId ? parseInt(userId, 10) : 0;

  const { data: rawSavedIds } = useQuery<number[]>({
    queryKey: ["/api/saved-freelancers"],
    enabled: isRecruiter && !isOwnProfile,
  });
  const savedIds = Array.isArray(rawSavedIds) ? rawSavedIds : [];
  const isSaved = savedIds.includes(profileUserId);

  const saveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/saved-freelancers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ freelancerId: profileUserId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-freelancers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-crew"] });
      toast({ title: "Saved to My Crew", description: "Freelancer saved to your My Crew list." });
    },
  });

  const unsaveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/saved-freelancers/${profileUserId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-freelancers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-crew"] });
      toast({
        title: "Removed from My Crew",
        description: "Freelancer removed from your My Crew list.",
      });
    },
  });

  // Get rating data for freelancer profiles
  const { data: averageRating } = useFreelancerAverageRating(freelancerProfile?.user_id || 0);

  // Get active jobs for recruiter profiles
  const { data: recruiterJobs = [] } = useQuery<any[]>({
    queryKey: ["/api/jobs/recruiter", profileUserId],
    queryFn: () => apiRequest(`/api/jobs/recruiter/${profileUserId}`),
    enabled: !!profileUserId && !!recruiterProfile,
    select: (jobs) => jobs.filter((j) => j.status === "active"),
  });

  const handleDownloadCV = async (cvProfile: FreelancerProfile) => {
    if (!user) {
      redirectToAuth();
      return;
    }
    if (!cvProfile.cv_file_url) {
      toast({
        title: "Error",
        description: "CV not available for download",
        variant: "destructive",
      });
      return;
    }

    try {
      const token = localStorage.getItem("auth_token");

      // Stream the CV directly through the server (never expiring URL)
      const response = await fetch(`/api/cv/download/${cvProfile.user_id}`, {
        method: "GET",
        credentials: "include",
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || "Failed to download CV");
      }

      // Create a blob URL from the streamed file and open it in a new tab
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
      toast({
        title: "Success",
        description: "CV opened in new tab",
      });
    } catch (error) {
      console.error("Error downloading CV:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to download CV",
        variant: "destructive",
      });
    }
  };

  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showStandaloneRatingDialog, setShowStandaloneRatingDialog] = useState(false);

  // Handle "Invite to Rate" deep link action
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("action") === "rate") {
      if (!user) {
        // Redirect to auth if not logged in, preserving the return URL
        const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
        setLocation(`/auth?redirect=${returnUrl}&reason=rate`);
      } else if (freelancerProfile && user.id !== freelancerProfile.user_id) {
        // Remove the query param to prevent reopening on refresh (optional but good UX)
        // window.history.replaceState({}, document.title, window.location.pathname);
        // Actually, keep it for now so if they accidentally close they can refresh to get it back?
        // Better UX is probably to just open it.
        setShowStandaloneRatingDialog(true);
      }
    }
    // Handle "Contact" deep link action for promotional profile
    if (params.get("action") === "contact") {
      if (profile?.email?.toLowerCase() === EVENTLINK_PROMOTIONAL_EMAIL) {
        setIsMessageModalOpen(true);
      } else if (!user) {
        setLocation("/auth");
      } else {
        setIsMessageModalOpen(true);
      }
    }
  }, [user, location, freelancerProfile, setLocation, profile]); // Added setLocation to dependencies

  useEffect(() => {
    if (!authLoading) {
      if (userId) {
        // Check if viewing own profile via URL parameter
        const isViewingOwnProfile = user && userId === user.id.toString();

        if (isViewingOwnProfile) {
          fetchProfile();
        } else {
          // Viewing someone else's profile
          setIsOwnProfile(false);
          fetchOtherProfile(userId);
        }
      } else if (user) {
        // Viewing own profile
        setIsOwnProfile(true);
        fetchProfile();
      } else if (!userId) {
        // Not logged in and no userId specified
        setLocation("/auth");
      } else {
        // Not logged in but viewing someone else's profile via URL - allow viewing
        setIsOwnProfile(false);
        fetchOtherProfile(userId);
      }
    }
  }, [user, authLoading, userId, setLocation]);

  const fetchProfile = async () => {
    try {
      console.log("fetchProfile called with user:", user);
      const userProfile: Profile = {
        id: user!.id.toString(),
        role: user!.role as "freelancer" | "recruiter" | "admin",
        email: user!.email,
      };
      console.log("Setting profile:", userProfile);
      setProfile(userProfile);

      // Try to fetch freelancer profile for freelancer and admin users
      if (userProfile.role === "freelancer" || userProfile.role === "admin") {
        try {
          const data = await apiRequest(`/api/freelancer/${userProfile.id}`);
          console.log("Freelancer profile data received:", data);
          if (data) {
            setFreelancerProfile({
              id: data.id,
              user_id: data.user_id,
              first_name: data.first_name || "",
              last_name: data.last_name || "",
              title: data.title || "",
              bio: data.bio || "",
              superpower: data.superpower || "",
              location: data.location || "",
              experience_years: data.experience_years || null,
              skills: data.skills || [],
              portfolio_url: data.portfolio_url || "",
              linkedin_url: data.linkedin_url || "",
              website_url: data.website_url || "",
              availability_status: data.availability_status || "available",
              profile_photo_url: data.profile_photo_url || "",
              slug: data.slug || null,
              custom_slug: data.custom_slug || null,
              reference_token: data.reference_token || null,
              cv_file_url: data.cv_file_url || "",
              cv_file_name: data.cv_file_name || "",
              cv_file_type: data.cv_file_type || "",
              cv_file_size: data.cv_file_size || null,
            });
            console.log("Freelancer profile set:", data);
          } else {
            console.log("No freelancer profile found");
            setFreelancerProfile(null);
          }
        } catch (error) {
          console.log("No freelancer profile found:", error);
          setFreelancerProfile(null);
        }
      }

      // Try to fetch recruiter profile for recruiter and admin users
      if (userProfile.role === "recruiter" || userProfile.role === "admin") {
        try {
          const data = await apiRequest(`/api/recruiter/${userProfile.id}`);
          console.log("Recruiter profile data received:", data);
          if (data) {
            console.log("Setting recruiter profile with data:", data);
            setRecruiterProfile({
              id: data.id?.toString(),
              company_name: data.company_name || "",
              contact_name: data.contact_name || "",
              company_type: data.company_type || "",
              description: data.description || "",
              location: data.location || "",
              website_url: data.website_url || "",
              linkedin_url: data.linkedin_url || "",
              company_logo_url: data.company_logo_url || "",
            });
            console.log("Recruiter profile set successfully");
          } else {
            console.log("No recruiter profile data received from API");
            setRecruiterProfile(null);
          }
        } catch (error) {
          console.log("No recruiter profile found:", error);
          setRecruiterProfile(null);
        }
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
      setProfileDataLoaded(true);
    }
  };

  const fetchOtherProfile = async (targetParam: string) => {
    try {
      const isNumeric = /^\d+$/.test(targetParam);

      // For slugs (non-numeric), fetch the freelancer profile first to get user_id
      let resolvedUserId = targetParam;
      if (!isNumeric) {
        const profileData = await apiRequest(`/api/freelancer/${targetParam}`);
        if (!profileData) throw new Error("Profile not found");
        resolvedUserId = profileData.user_id.toString();
        setFreelancerProfile({
          id: profileData.id,
          user_id: profileData.user_id,
          first_name: profileData.first_name || "",
          last_name: profileData.last_name || "",
          title: profileData.title || "",
          bio: profileData.bio || "",
          location: profileData.location || "",
          superpower: profileData.superpower || "",
          experience_years: profileData.experience_years || null,
          skills: profileData.skills || [],
          portfolio_url: profileData.portfolio_url || "",
          linkedin_url: profileData.linkedin_url || "",
          website_url: profileData.website_url || "",
          availability_status: profileData.availability_status || "available",
          profile_photo_url: profileData.profile_photo_url || "",
          slug: profileData.slug || null,
          custom_slug: profileData.custom_slug || null,
          reference_token: profileData.reference_token || null,
          cv_file_url: profileData.cv_file_url || "",
          cv_file_name: profileData.cv_file_name || "",
          cv_file_type: profileData.cv_file_type || "",
          cv_file_size: profileData.cv_file_size || null,
        });
      }

      // Get the user basic info to determine role
      const userData = await apiRequest(`/api/users/${resolvedUserId}`);
      const userProfile: Profile = {
        id: resolvedUserId,
        role: userData.role as "freelancer" | "recruiter",
        email: userData.email,
      };
      setProfile(userProfile);

      if (userProfile.role === "freelancer" && isNumeric) {
        try {
          const data = await apiRequest(`/api/freelancer/${resolvedUserId}`);
          if (data) {
            setFreelancerProfile({
              id: data.id,
              user_id: data.user_id,
              first_name: data.first_name || "",
              last_name: data.last_name || "",
              title: data.title || "",
              bio: data.bio || "",
              location: data.location || "",
              superpower: data.superpower || "",
              experience_years: data.experience_years || null,
              skills: data.skills || [],
              portfolio_url: data.portfolio_url || "",
              linkedin_url: data.linkedin_url || "",
              website_url: data.website_url || "",
              availability_status: data.availability_status || "available",
              profile_photo_url: data.profile_photo_url || "",
              slug: data.slug || null,
              custom_slug: data.custom_slug || null,
              reference_token: data.reference_token || null,
              cv_file_url: data.cv_file_url || "",
              cv_file_name: data.cv_file_name || "",
              cv_file_type: data.cv_file_type || "",
              cv_file_size: data.cv_file_size || null,
            });
          }
        } catch (error) {
          console.log("No freelancer profile found for user:", error);
        }
      } else if (userProfile.role === "recruiter") {
        try {
          const data = await apiRequest(`/api/recruiter/${targetUserId}`);
          if (data) {
            setRecruiterProfile({
              id: data.id?.toString(),
              company_name: data.company_name || "",
              contact_name: data.contact_name || "",
              company_type: data.company_type || "",
              description: data.description || "",
              location: data.location || "",
              website_url: data.website_url || "",
              linkedin_url: data.linkedin_url || "",
              company_logo_url: data.company_logo_url || "",
            });
          }
        } catch (error) {
          console.log("No recruiter profile found for user:", error);
        }
      }
    } catch (error) {
      console.error("Error fetching other user profile:", error);
    } finally {
      setLoading(false);
      setProfileDataLoaded(true);
    }
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="mx-auto max-w-4xl space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="mb-4 text-2xl font-bold">Profile Not Found</h1>
            <Button onClick={() => setLocation(user ? "/dashboard" : "/")}>
              {user ? "Go to Dashboard" : "Go to EventLink"}
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  if (profile?.role === "freelancer" && !freelancerProfile && !loading && profileDataLoaded) {
    console.log("No freelancer profile found, showing create profile message");
    if (!user || (user && userId && userId === user.id.toString())) {
      return (
        <Layout>
          <div className="container mx-auto px-4 py-8">
            <div className="mx-auto max-w-4xl space-y-4 text-center">
              <div className="bg-gradient-primary mx-auto flex h-24 w-24 items-center justify-center rounded-full">
                <User className="h-12 w-12 text-white" />
              </div>
              <h1 className="text-2xl font-bold">Complete Your Profile</h1>
              <p className="text-muted-foreground">
                Create your freelancer profile to start connecting with event organizers.
              </p>
              <Button
                onClick={() => setLocation("/dashboard")}
                className="bg-gradient-primary hover:bg-primary-hover"
              >
                Create Profile
              </Button>
            </div>
          </div>
        </Layout>
      );
    }
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="mx-auto max-w-4xl space-y-4 text-center">
            <div className="bg-gradient-primary mx-auto flex h-24 w-24 items-center justify-center rounded-full">
              <User className="h-12 w-12 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Profile Not Yet Set Up</h1>
            <p className="text-muted-foreground">
              This freelancer has not completed their profile yet. Check back later.
            </p>
            <Button onClick={() => setLocation("/")} variant="outline">
              Browse EventLink
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // Show create profile message for users who should have recruiter profiles but don't
  if (
    (profile?.role === "recruiter" || (profile?.role === "admin" && !freelancerProfile)) &&
    !recruiterProfile &&
    !loading
  ) {
    const isOwnRecruiterProfile = user && userId && userId === user.id.toString();
    if (!user || isOwnRecruiterProfile) {
      return (
        <Layout>
          <div className="container mx-auto px-4 py-8">
            <div className="mx-auto max-w-4xl space-y-4 text-center">
              <div className="bg-gradient-primary mx-auto flex h-24 w-24 items-center justify-center rounded-full">
                <User className="h-12 w-12 text-white" />
              </div>
              <h1 className="text-2xl font-bold">Complete Your Company Profile</h1>
              <p className="text-muted-foreground">
                Create your company profile to start posting jobs and finding talent.
              </p>
              <Button
                onClick={() => setLocation("/dashboard")}
                className="bg-gradient-primary hover:bg-primary-hover"
              >
                Create Profile
              </Button>
            </div>
          </div>
        </Layout>
      );
    }
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="mx-auto max-w-4xl space-y-4 text-center">
            <div className="bg-gradient-primary mx-auto flex h-24 w-24 items-center justify-center rounded-full">
              <User className="h-12 w-12 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Profile Not Yet Set Up</h1>
            <p className="text-muted-foreground">
              This company has not completed their profile yet. Check back later.
            </p>
            <Button onClick={() => setLocation("/")} variant="outline">
              Browse EventLink
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const isPromotionalProfile = profile?.email?.toLowerCase() === EVENTLINK_PROMOTIONAL_EMAIL;

  const redirectToAuth = () => {
    const currentPath = window.location.pathname;
    setLocation(`/auth?redirect=${encodeURIComponent(currentPath)}`);
  };

  const handleContactClick = () => {
    if (!user && !isPromotionalProfile) {
      redirectToAuth();
      return;
    }

    setIsMessageModalOpen(true);
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Own profile — shareable URL banner */}
          {isOwnProfile && freelancerProfile && (
            <div className="flex flex-col items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Your public profile link
                </p>
                <p className="truncate text-sm text-muted-foreground">{getProfileUrl()}</p>
              </div>
              <Button size="sm" variant="outline" onClick={handleShareProfile} className="shrink-0">
                {linkCopied ? (
                  <>
                    <Check className="mr-2 h-3.5 w-3.5 text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-3.5 w-3.5" />
                    Copy Link
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Profile Header */}
          <Card>
            <CardContent className="p-8">
              {(freelancerProfile && profile?.role !== "admin") ||
              (profile?.role === "admin" && freelancerProfile && !recruiterProfile) ? (
                <div className="flex flex-col items-center gap-6 text-center md:flex-row md:items-start md:text-left">
                  <div className="bg-gradient-primary flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-full shadow-lg ring-4 ring-background">
                    {freelancerProfile?.profile_photo_url &&
                    freelancerProfile.profile_photo_url.trim() !== "" &&
                    freelancerProfile.profile_photo_url !== "null" ? (
                      <img
                        src={`/api/profile-photo/${freelancerProfile.user_id}`}
                        alt="Profile"
                        className="h-full w-full bg-white object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <User className="h-16 w-16 text-white" />
                    )}
                  </div>

                  <div className="flex-1 space-y-4">
                    <div>
                      <div className="mb-2 flex flex-col items-center justify-between gap-4 sm:flex-row sm:items-start">
                        <h1 className="text-3xl font-bold leading-tight">
                          {freelancerProfile?.first_name} {freelancerProfile?.last_name}
                        </h1>
                        <div className="flex flex-wrap gap-2">
                          {isOwnProfile && (
                            <Button
                              variant="outline"
                              onClick={() => setLocation("/dashboard")}
                              className="w-full sm:w-auto"
                            >
                              Edit Profile
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            onClick={handleShareProfile}
                            className="w-full sm:w-auto"
                          >
                            {linkCopied ? (
                              <>
                                <Check className="mr-2 h-4 w-4 text-green-600" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Share2 className="mr-2 h-4 w-4" />
                                Share Profile
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                      <p className="mb-2 text-xl font-semibold text-primary">
                        {freelancerProfile?.title}
                      </p>
                      {freelancerProfile?.superpower && (
                        <div className="mb-3 flex flex-col items-center gap-1 sm:flex-row sm:gap-2 md:justify-start">
                          <span className="text-sm font-medium text-muted-foreground">
                            Superpower:
                          </span>
                          <Badge className="max-w-full border-0 bg-gradient-to-r from-purple-500 to-pink-500 py-1 text-center text-sm hover:from-purple-600 hover:to-pink-600 sm:text-left">
                            ⚡ {freelancerProfile.superpower}
                          </Badge>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-muted-foreground md:justify-start">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {freelancerProfile?.location || "UK"}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {freelancerProfile?.experience_years} years experience
                        </div>
                        {averageRating && (
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4" />
                            <RatingDisplay
                              average={averageRating.average}
                              count={averageRating.count}
                              size="sm"
                              showText={true}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-2 md:justify-start">
                      <div
                        className={`h-3 w-3 rounded-full ${
                          freelancerProfile?.availability_status === "available"
                            ? "bg-green-500"
                            : freelancerProfile?.availability_status === "busy"
                              ? "bg-yellow-500"
                              : "bg-red-500"
                        }`}
                      ></div>
                      <Badge variant="outline" className="capitalize">
                        {freelancerProfile?.availability_status}
                      </Badge>
                    </div>

                    <ReferenceBadges freelancerId={freelancerProfile?.user_id || 0} />

                    <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                      {!isOwnProfile && (
                        <Button
                          onClick={handleContactClick}
                          className="bg-gradient-primary hover:bg-primary-hover w-full sm:w-auto"
                        >
                          <MessageCircle className="mr-2 h-4 w-4" />
                          Send Message
                        </Button>
                      )}
                      {isRecruiter && !isOwnProfile && profile?.role === "freelancer" && (
                        <Button
                          variant={isSaved ? "default" : "outline"}
                          className={cn(
                            "w-full sm:w-auto",
                            isSaved ? "bg-orange-500 hover:bg-orange-600" : ""
                          )}
                          onClick={() =>
                            isSaved ? unsaveMutation.mutate() : saveMutation.mutate()
                          }
                          disabled={saveMutation.isPending || unsaveMutation.isPending}
                        >
                          <Bookmark className={`mr-2 h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
                          {isSaved ? "Saved" : "Save"}
                        </Button>
                      )}
                      {freelancerProfile?.cv_file_url && (
                        <Button
                          onClick={() => {
                            if (!user) {
                              redirectToAuth();
                              return;
                            }
                            handleDownloadCV(freelancerProfile);
                          }}
                          className="flex w-full items-center gap-2 sm:w-auto"
                          variant="outline"
                          data-testid="button-download-cv-profile"
                        >
                          <Download className="h-4 w-4" />
                          Download CV
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-start gap-6 md:flex-row">
                  <div className="bg-gradient-primary flex h-32 w-32 items-center justify-center overflow-hidden rounded-full">
                    {recruiterProfile?.company_logo_url &&
                    recruiterProfile.company_logo_url.trim() !== "" &&
                    recruiterProfile.company_logo_url !== "null" &&
                    recruiterProfile.company_logo_url.startsWith("data:") ? (
                      <img
                        src={recruiterProfile.company_logo_url}
                        alt="Company Logo"
                        className="h-full w-full bg-white object-cover"
                      />
                    ) : (
                      <User className="h-16 w-16 text-white" />
                    )}
                  </div>

                  <div className="flex-1 space-y-4">
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <h1 className="text-3xl font-bold">{recruiterProfile?.company_name}</h1>
                        {isOwnProfile && (
                          <Button variant="outline" onClick={() => setLocation("/dashboard")}>
                            Edit Profile
                          </Button>
                        )}
                      </div>
                      <p className="mb-2 text-xl font-semibold text-primary">
                        {recruiterProfile.company_type
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (l) => l.toUpperCase())}
                      </p>
                      <div className="flex items-center gap-4 text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          {recruiterProfile?.contact_name}
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {recruiterProfile?.location || "UK"}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      {!isOwnProfile && (
                        <Button
                          onClick={handleContactClick}
                          className="bg-gradient-primary hover:bg-primary-hover"
                        >
                          <MessageCircle className="mr-2 h-4 w-4" />
                          Send Message
                        </Button>
                      )}{" "}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* About Section */}
          <Card>
            <CardHeader>
              <CardTitle>
                {(freelancerProfile && profile?.role !== "admin") ||
                (profile?.role === "admin" && freelancerProfile && !recruiterProfile)
                  ? "About"
                  : "Company Description"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-relaxed text-muted-foreground">
                {(freelancerProfile && profile?.role !== "admin") ||
                (profile?.role === "admin" && freelancerProfile && !recruiterProfile)
                  ? freelancerProfile?.bio || "No bio available."
                  : recruiterProfile?.description || "No company description available."}
              </p>
            </CardContent>
          </Card>

          {/* Skills Section (Freelancers only) */}
          {((freelancerProfile && profile?.role !== "admin") ||
            (profile?.role === "admin" && freelancerProfile && !recruiterProfile)) && (
            <Card>
              <CardHeader>
                <CardTitle>Skills & Expertise</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {freelancerProfile?.skills.map((skill, index) => (
                    <Badge key={index} variant="secondary" className="px-3 py-1">
                      {skill}
                    </Badge>
                  ))}
                  {(!freelancerProfile?.skills || freelancerProfile.skills.length === 0) && (
                    <p className="text-muted-foreground">No skills added yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Documents & Certifications Section (Freelancers only) */}
          {((freelancerProfile && profile?.role !== "admin") ||
            (profile?.role === "admin" && freelancerProfile && !recruiterProfile)) && (
            <div className="mb-6">
              <DocumentUploader
                userId={freelancerProfile?.user_id || 0}
                isOwner={isOwnProfile}
                viewerRole={user?.role as "freelancer" | "recruiter" | "admin"}
                publicToken={!user ? publicToken : undefined}
              />
            </div>
          )}

          {/* Featured Reviews Section (Freelancers only) - for future use
          {((freelancerProfile && profile?.role !== "admin") ||
            (profile?.role === "admin" && freelancerProfile && !recruiterProfile)) && (
            <div className="mb-6">
              <FeaturedReviews freelancerId={freelancerProfile?.user_id || 0} />
            </div>
          )}
          */}

          {/* Reviews Section (Freelancers only) */}
          {((freelancerProfile && profile?.role !== "admin") ||
            (profile?.role === "admin" && freelancerProfile && !recruiterProfile)) && (
            <ReviewsSection freelancerId={freelancerProfile?.user_id || 0} />
          )}

          {/* References Section (Freelancers only) */}
          {((freelancerProfile && profile?.role !== "admin") ||
            (profile?.role === "admin" && freelancerProfile && !recruiterProfile)) && (
            <ReferencesSection freelancerId={freelancerProfile?.user_id || 0} currentUser={user} />
          )}

          {/* Portfolio Section (Freelancers only) */}
          {freelancerProfile?.user_id && (
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <FreelancerPortfolio
                userId={freelancerProfile.user_id}
                editable={false}
                hideWhenEmpty
              />
            </div>
          )}

          {/* Links Section */}
          {(() => {
            const showFreelancerProfile =
              (freelancerProfile && profile?.role !== "admin") ||
              (profile?.role === "admin" && freelancerProfile && !recruiterProfile);
            const hasFreelancerLinks =
              freelancerProfile?.portfolio_url ||
              freelancerProfile?.linkedin_url ||
              freelancerProfile?.website_url;
            const hasRecruiterLinks =
              recruiterProfile?.website_url || recruiterProfile?.linkedin_url;
            return (
              (showFreelancerProfile && hasFreelancerLinks) ||
              (recruiterProfile && hasRecruiterLinks)
            );
          })() && (
            <Card>
              <CardHeader>
                <CardTitle>Links</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(() => {
                    const showFreelancerProfile =
                      (freelancerProfile && profile?.role !== "admin") ||
                      (profile?.role === "admin" && freelancerProfile && !recruiterProfile);
                    return showFreelancerProfile;
                  })() ? (
                    <>
                      {freelancerProfile?.portfolio_url && (
                        <a
                          href={(() => {
                            const u = freelancerProfile.portfolio_url.trim();
                            return u.match(/^https?:\/\//) ? u : `https://${u}`;
                          })()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-primary hover:underline"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Portfolio
                        </a>
                      )}
                      {freelancerProfile?.linkedin_url && (
                        <a
                          href={(() => {
                            const u = freelancerProfile.linkedin_url.trim();
                            return u.match(/^https?:\/\//) ? u : `https://${u}`;
                          })()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-primary hover:underline"
                        >
                          <Linkedin className="h-4 w-4" />
                          LinkedIn
                        </a>
                      )}
                      {freelancerProfile?.website_url && (
                        <a
                          href={(() => {
                            const u = freelancerProfile.website_url.trim();
                            return u.match(/^https?:\/\//) ? u : `https://${u}`;
                          })()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-primary hover:underline"
                        >
                          <Globe className="h-4 w-4" />
                          Website
                        </a>
                      )}
                    </>
                  ) : (
                    <>
                      {recruiterProfile?.website_url && (
                        <a
                          href={(() => {
                            const u = recruiterProfile.website_url.trim();
                            return u.match(/^https?:\/\//) ? u : `https://${u}`;
                          })()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-primary hover:underline"
                        >
                          <Globe className="h-4 w-4" />
                          Company Website
                        </a>
                      )}
                      {recruiterProfile?.linkedin_url && (
                        <a
                          href={(() => {
                            const u = recruiterProfile.linkedin_url.trim();
                            return u.match(/^https?:\/\//) ? u : `https://${u}`;
                          })()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-primary hover:underline"
                        >
                          <Linkedin className="h-4 w-4" />
                          LinkedIn
                        </a>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          {/* Vanity URL editor — own freelancer profile only */}
          {isOwnProfile && freelancerProfile && (
            <VanityUrlEditor
              userId={freelancerProfile.user_id}
              currentCustomSlug={freelancerProfile.custom_slug}
              currentSlug={freelancerProfile.slug}
            />
          )}

          {/* QR Code — own freelancer profile only */}
          {isOwnProfile && freelancerProfile && (
            <ProfileQRCode userId={freelancerProfile.user_id} profileUrl={getProfileUrl()} />
          )}

          {/* Active Job Openings (Recruiter profiles only) */}
          {recruiterProfile && recruiterJobs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  Current Openings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recruiterJobs.map((job) => (
                  <a
                    key={job.id}
                    href={`/jobs?jobId=${job.id}`}
                    className="block rounded-lg border p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <h3 className="font-semibold leading-tight">{job.title}</h3>
                      <Badge
                        variant="secondary"
                        className="shrink-0 bg-primary/10 text-xs text-primary"
                      >
                        Active
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {job.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {job.location}
                        </span>
                      )}
                      {job.rate && (
                        <span className="flex items-center gap-1">
                          <span className="text-xs font-medium">£</span>
                          {job.rate}
                        </span>
                      )}
                      {job.event_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(job.event_date).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                  </a>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Message Modal */}
      {profile && user && (
        <MessageModal
          isOpen={isMessageModalOpen}
          onClose={() => setIsMessageModalOpen(false)}
          recipientId={parseInt(profile.id)}
          recipientName={
            profile.role === "freelancer"
              ? `${freelancerProfile?.first_name} ${freelancerProfile?.last_name}`
              : recruiterProfile?.company_name || "User"
          }
          senderId={user.id}
        />
      )}

      <InviteClientsDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        userId={user?.id || 0}
      />

      {freelancerProfile && user && (
        <StandaloneRatingDialog
          open={showStandaloneRatingDialog}
          onOpenChange={setShowStandaloneRatingDialog}
          freelancerId={freelancerProfile.user_id}
          freelancerName={`${freelancerProfile.first_name} ${freelancerProfile.last_name}`}
          recruiterId={user.id}
        />
      )}
    </Layout>
  );
}
