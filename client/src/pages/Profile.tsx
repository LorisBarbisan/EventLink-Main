import { InviteClientsDialog } from "@/components/InviteClientsDialog";
import { Layout } from "@/components/Layout";
import { MessageModal } from "@/components/MessageModal";
import { StandaloneRatingDialog } from "@/components/StandaloneRatingDialog";
import { RatingDisplay, StarRating } from "@/components/StarRating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  useFreelancerAverageRating,
  useFreelancerRatings,
  useReportRating,
} from "@/hooks/useRatings";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Calendar,
  Download,
  ExternalLink,
  Flag,
  Globe,
  Linkedin,
  MapPin,
  MessageCircle,
  Phone,
  Quote,
  Shield,
  Star,
  User,
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
  company_description: string;
  location: string;
  website_url: string;
  linkedin_url: string;
  phone: string;
  company_logo_url?: string;
}

function FeaturedReviews({ freelancerId }: { freelancerId: number }) {
  const { data: ratings = [] } = useFreelancerRatings(freelancerId);

  // Filter and sort reviews
  // Criteria: Has review text, highest rating, longest review, newest
  const featuredReviews = ratings
    .filter((r: any) => r.review && r.review.trim().length > 0)
    .sort((a: any, b: any) => {
      if (b.rating !== a.rating) return b.rating - a.rating; // Highest rating first
      if (b.review.length !== a.review.length) return b.review.length - a.review.length; // Longest review second
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); // Newest third
    })
    .slice(0, 5); // Take top 5

  if (featuredReviews.length === 0) return null;

  return (
    <Card className="bg-gradient-to-br from-card to-accent/20 border-accent/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
          Featured Reviews
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Carousel
          opts={{
            align: "start",
            loop: true,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-1">
            {featuredReviews.map((rating: any) => (
              <CarouselItem key={rating.id} className="pl-1 md:basis-1/2 lg:basis-1/3">
                <div className="p-1 h-full">
                  <Card className="h-full bg-card/50 hover:bg-card transition-colors">
                    <CardContent className="flex flex-col h-full p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-bold text-primary">
                              {rating.recruiter?.first_name?.[0] || "R"}
                            </span>
                          </div>
                          <span className="text-sm font-semibold">
                            {rating.recruiter?.first_name || "Recruiter"}
                          </span>
                        </div>
                        <StarRating rating={rating.rating} readonly size="sm" />
                      </div>
                      <div className="relative flex-1">
                        <Quote className="w-4 h-4 text-muted-foreground/30 absolute -top-1 -left-1" />
                        <p className="text-sm text-muted-foreground line-clamp-4 pt-2 px-2 italic">
                          &quot;{rating.review}&quot;
                        </p>
                      </div>
                      <div className="mt-4 pt-2 border-t text-xs text-muted-foreground flex justify-between items-center">
                        <span>{rating.job_title || "Project"}</span>
                        <span>{format(new Date(rating.created_at), "MMM yyyy")}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          {featuredReviews.length > 1 && (
            <>
              <CarouselPrevious className="left-0 -ml-3 bg-background/80 backdrop-blur-sm" />
              <CarouselNext className="right-0 -mr-3 bg-background/80 backdrop-blur-sm" />
            </>
          )}
        </Carousel>
      </CardContent>
    </Card>
  );
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
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          {rating.recruiter?.first_name || "Recruiter"}{" "}
                          {rating.recruiter?.last_name || ""}
                        </span>
                        <span className="text-muted-foreground text-sm">•</span>
                        <StarRating rating={rating.rating} readonly size="sm" />
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleReportClick(rating.id)}
                        title="Report review"
                      >
                        <Flag className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground italic mb-2">
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

export default function Profile() {
  const [, setLocation] = useLocation();
  const { userId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [freelancerProfile, setFreelancerProfile] = useState<FreelancerProfile | null>(null);
  const [recruiterProfile, setRecruiterProfile] = useState<RecruiterProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [profileDataLoaded, setProfileDataLoaded] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);

  const { toast } = useToast();

  // Get rating data for freelancer profiles
  const { data: averageRating } = useFreelancerAverageRating(freelancerProfile?.user_id || 0);

  // Helper function to format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Handle CV download
  const handleDownloadCV = async (cvProfile: FreelancerProfile) => {
    const isViewingPromotional = profile?.email?.toLowerCase() === EVENTLINK_PROMOTIONAL_EMAIL;
    if (!cvProfile.cv_file_url || (!user && !isViewingPromotional)) {
      toast({
        title: "Error",
        description: "CV not available for download",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get JWT token from localStorage for authentication
      const token = localStorage.getItem("auth_token");

      // Get the presigned download URL from the backend
      const response = await fetch(`/api/cv/download/${cvProfile.user_id}`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || "Failed to get download URL");
      }

      const { downloadUrl } = await response.json();

      // Open the presigned URL in a new tab to view/download the CV
      if (downloadUrl) {
        window.open(downloadUrl, "_blank");
        toast({
          title: "Success",
          description: "CV opened in new tab",
        });
      }
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
              company_description: data.company_description || "",
              location: data.location || "",
              website_url: data.website_url || "",
              linkedin_url: data.linkedin_url || "",
              phone: data.phone || "",
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

  const fetchOtherProfile = async (targetUserId: string) => {
    try {
      // First get the user basic info to determine their role
      const userData = await apiRequest(`/api/users/${targetUserId}`);
      const userProfile: Profile = {
        id: targetUserId,
        role: userData.role as "freelancer" | "recruiter",
        email: userData.email,
      };
      setProfile(userProfile);

      if (userProfile.role === "freelancer") {
        try {
          const data = await apiRequest(`/api/freelancer/${targetUserId}`);
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
              company_description: data.company_description || "",
              location: data.location || "",
              website_url: data.website_url || "",
              linkedin_url: data.linkedin_url || "",
              phone: data.phone || "",
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
    }
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-6">
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
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-2xl font-bold mb-4">Profile Not Found</h1>
            <Button onClick={() => setLocation("/dashboard")}>Go to Dashboard</Button>
          </div>
        </div>
      </Layout>
    );
  }

  if (profile?.role === "freelancer" && !freelancerProfile && !loading && profileDataLoaded) {
    console.log("No freelancer profile found, showing create profile message");
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto text-center space-y-4">
            <div className="w-24 h-24 bg-gradient-primary rounded-full flex items-center justify-center mx-auto">
              <User className="w-12 h-12 text-white" />
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

  // Show create profile message for users who should have recruiter profiles but don't
  if (
    (profile?.role === "recruiter" || (profile?.role === "admin" && !freelancerProfile)) &&
    !recruiterProfile &&
    !loading
  ) {
    console.log("No recruiter profile found, showing create profile message");
    console.log("Current recruiterProfile state:", recruiterProfile);
    console.log("Profile role:", profile?.role);
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto text-center space-y-4">
            <div className="w-24 h-24 bg-gradient-primary rounded-full flex items-center justify-center mx-auto">
              <User className="w-12 h-12 text-white" />
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

  const isPromotionalProfile = profile?.email?.toLowerCase() === EVENTLINK_PROMOTIONAL_EMAIL;

  const handleContactClick = () => {
    if (!user && !isPromotionalProfile) {
      setLocation("/auth");
      return;
    }

    setIsMessageModalOpen(true);
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Profile Header */}
          <Card>
            <CardContent className="p-8">
              {(freelancerProfile && profile?.role !== "admin") ||
              (profile?.role === "admin" && freelancerProfile && !recruiterProfile) ? (
                <div className="flex flex-col md:flex-row items-start gap-6">
                  <div className="w-32 h-32 bg-gradient-primary rounded-full flex items-center justify-center overflow-hidden">
                    {freelancerProfile?.profile_photo_url &&
                    freelancerProfile.profile_photo_url.trim() !== "" &&
                    freelancerProfile.profile_photo_url !== "null" &&
                    freelancerProfile.profile_photo_url.startsWith("data:") ? (
                      <img
                        src={freelancerProfile.profile_photo_url}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-16 h-16 text-white" />
                    )}
                  </div>

                  <div className="flex-1 space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h1 className="text-3xl font-bold">
                          {freelancerProfile?.first_name} {freelancerProfile?.last_name}
                        </h1>
                        {isOwnProfile && (
                          <Button variant="outline" onClick={() => setLocation("/dashboard")}>
                            Edit Profile
                          </Button>
                        )}
                      </div>
                      <p className="text-xl text-primary font-semibold mb-2">
                        {freelancerProfile?.title}
                      </p>
                      {freelancerProfile?.superpower && (
                        <div className="mb-3 flex items-center gap-2">
                          <span className="text-sm font-medium text-muted-foreground">
                            Superpower:
                          </span>
                          <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 border-0 text-sm py-1">
                            ⚡ {freelancerProfile.superpower}
                          </Badge>
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {freelancerProfile?.location}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {freelancerProfile?.experience_years} years experience
                        </div>
                        {averageRating && (
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4" />
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

                    <div className="flex items-center gap-2">
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

                    <div className="flex gap-3 pt-2">
                      {!isOwnProfile && (
                        <Button
                          onClick={handleContactClick}
                          className="bg-gradient-primary hover:bg-primary-hover"
                        >
                          <MessageCircle className="w-4 h-4 mr-2" />
                          Send Message
                        </Button>
                      )}
                      {freelancerProfile?.cv_file_url &&
                        ((!isOwnProfile &&
                          (user?.role === "recruiter" || user?.role === "admin")) ||
                          isOwnProfile) && (
                          <Button
                            onClick={() => handleDownloadCV(freelancerProfile)}
                            className="flex items-center gap-2"
                            variant="outline"
                            data-testid="button-download-cv-profile"
                          >
                            <Download className="w-4 h-4" />
                            Download CV
                          </Button>
                        )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col md:flex-row items-start gap-6">
                  <div className="w-32 h-32 bg-gradient-primary rounded-full flex items-center justify-center overflow-hidden">
                    {recruiterProfile?.company_logo_url &&
                    recruiterProfile.company_logo_url.trim() !== "" &&
                    recruiterProfile.company_logo_url !== "null" &&
                    recruiterProfile.company_logo_url.startsWith("data:") ? (
                      <img
                        src={recruiterProfile.company_logo_url}
                        alt="Company Logo"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-16 h-16 text-white" />
                    )}
                  </div>

                  <div className="flex-1 space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h1 className="text-3xl font-bold">{recruiterProfile?.company_name}</h1>
                        {isOwnProfile && (
                          <Button variant="outline" onClick={() => setLocation("/dashboard")}>
                            Edit Profile
                          </Button>
                        )}
                      </div>
                      <p className="text-xl text-primary font-semibold mb-2">
                        {recruiterProfile?.company_type}
                      </p>
                      <div className="flex items-center gap-4 text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {recruiterProfile?.contact_name}
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {recruiterProfile?.location}
                        </div>
                        {recruiterProfile?.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="w-4 h-4" />
                            {recruiterProfile.phone}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      {!isOwnProfile && (
                        <Button
                          onClick={handleContactClick}
                          className="bg-gradient-primary hover:bg-primary-hover"
                        >
                          <MessageCircle className="w-4 h-4 mr-2" />
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
              <p className="text-muted-foreground leading-relaxed">
                {(freelancerProfile && profile?.role !== "admin") ||
                (profile?.role === "admin" && freelancerProfile && !recruiterProfile)
                  ? freelancerProfile?.bio || "No bio available."
                  : recruiterProfile?.company_description || "No company description available."}
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
                          href={freelancerProfile.portfolio_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-primary hover:underline"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Portfolio
                        </a>
                      )}
                      {freelancerProfile?.linkedin_url && (
                        <a
                          href={freelancerProfile.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-primary hover:underline"
                        >
                          <Linkedin className="w-4 h-4" />
                          LinkedIn
                        </a>
                      )}
                      {freelancerProfile?.website_url && (
                        <a
                          href={freelancerProfile.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-primary hover:underline"
                        >
                          <Globe className="w-4 h-4" />
                          Website
                        </a>
                      )}
                    </>
                  ) : (
                    <>
                      {recruiterProfile?.website_url && (
                        <a
                          href={recruiterProfile.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-primary hover:underline"
                        >
                          <Globe className="w-4 h-4" />
                          Company Website
                        </a>
                      )}
                      {recruiterProfile?.linkedin_url && (
                        <a
                          href={recruiterProfile.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-primary hover:underline"
                        >
                          <Linkedin className="w-4 h-4" />
                          LinkedIn
                        </a>
                      )}
                    </>
                  )}
                </div>
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
