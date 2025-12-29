import { Layout } from "@/components/Layout";
import { MessageModal } from "@/components/MessageModal";
import { RatingDisplay } from "@/components/StarRating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useFreelancerAverageRating } from "@/hooks/useRatings";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Download,
  ExternalLink,
  Globe,
  Linkedin,
  MapPin,
  MessageCircle,
  Phone,
  Star,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";

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

export default function Profile() {
  const [, setLocation] = useLocation();
  const { userId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Determine target user ID and if viewing own profile
  const targetUserId = userId || user?.id?.toString();
  const isOwnProfile = user && targetUserId === user.id.toString();

  // Fetch user data to determine role
  const { data: userData, isLoading: userLoading } = useQuery<{ role: string; email: string }>({
    queryKey: ["/api/users", targetUserId],
    enabled: !!targetUserId && !authLoading,
    staleTime: 0,
  });

  // Determine profile role from userData or current user
  const profileRole = isOwnProfile ? user?.role : userData?.role;

  // Fetch freelancer profile using React Query (matches dashboard query key pattern)
  const { data: freelancerData, isLoading: freelancerLoading } = useQuery<{
    id: string;
    user_id: number;
    first_name: string;
    last_name: string;
    title: string;
    bio: string;
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
  }>({
    queryKey: ["/api/freelancer", parseInt(targetUserId || "0")],
    enabled: !!targetUserId && (profileRole === "freelancer" || profileRole === "admin"),
    staleTime: 0,
  });

  // Fetch recruiter profile using React Query (matches dashboard query key pattern)
  const { data: recruiterData, isLoading: recruiterLoading } = useQuery<{
    id: number;
    company_name: string;
    contact_name: string;
    company_type: string;
    description: string;
    location: string;
    website_url: string;
    linkedin_url: string;
    phone: string;
    company_logo_url?: string;
  }>({
    queryKey: ["/api/recruiter", parseInt(targetUserId || "0")],
    enabled: !!targetUserId && (profileRole === "recruiter" || profileRole === "admin"),
    staleTime: 0,
  });

  // Build profile object
  const profile: Profile | null = targetUserId && profileRole ? {
    id: targetUserId,
    role: profileRole as "freelancer" | "recruiter" | "admin",
    email: isOwnProfile ? user?.email || "" : userData?.email || "",
  } : null;

  // Transform freelancer data
  const freelancerProfile: FreelancerProfile | null = freelancerData ? {
    id: freelancerData.id,
    user_id: freelancerData.user_id,
    first_name: freelancerData.first_name || "",
    last_name: freelancerData.last_name || "",
    title: freelancerData.title || "",
    bio: freelancerData.bio || "",
    location: freelancerData.location || "",
    experience_years: freelancerData.experience_years || null,
    skills: freelancerData.skills || [],
    portfolio_url: freelancerData.portfolio_url || "",
    linkedin_url: freelancerData.linkedin_url || "",
    website_url: freelancerData.website_url || "",
    availability_status: freelancerData.availability_status || "available",
    profile_photo_url: freelancerData.profile_photo_url || "",
    cv_file_url: freelancerData.cv_file_url || "",
    cv_file_name: freelancerData.cv_file_name || "",
    cv_file_type: freelancerData.cv_file_type || "",
    cv_file_size: freelancerData.cv_file_size || undefined,
  } : null;

  // Transform recruiter data
  const recruiterProfile: RecruiterProfile | null = recruiterData ? {
    id: recruiterData.id?.toString(),
    company_name: recruiterData.company_name || "",
    contact_name: recruiterData.contact_name || "",
    company_type: recruiterData.company_type || "",
    company_description: recruiterData.description || "",
    location: recruiterData.location || "",
    website_url: recruiterData.website_url || "",
    linkedin_url: recruiterData.linkedin_url || "",
    phone: recruiterData.phone || "",
    company_logo_url: recruiterData.company_logo_url || "",
  } : null;

  const loading = authLoading || userLoading || freelancerLoading || recruiterLoading;
  const profileDataLoaded = !loading && !!targetUserId;

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
  const handleDownloadCV = async (profile: FreelancerProfile) => {
    if (!profile.cv_file_url || !user) {
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
      const response = await fetch(`/api/cv/download/${profile.user_id}`, {
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

      const { downloadUrl, fileName } = await response.json();

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

  // Redirect to auth if not logged in and no userId specified
  useEffect(() => {
    if (!authLoading && !userId && !user) {
      setLocation("/auth");
    }
  }, [user, authLoading, userId, setLocation]);

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

  // Mutation hook moved to top - no longer duplicated here

  const handleContactClick = () => {
    if (!user) {
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
                      <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-3xl font-bold">
                          {freelancerProfile?.first_name} {freelancerProfile?.last_name}
                        </h1>
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          VERIFIED
                        </Badge>
                      </div>
                      <p className="text-xl text-primary font-semibold mb-2">
                        {freelancerProfile?.title}
                      </p>
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
                      {isOwnProfile && (
                        <Button variant="outline" onClick={() => setLocation("/dashboard")}>
                          Edit Profile
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
                      <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-3xl font-bold">{recruiterProfile?.company_name}</h1>
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          VERIFIED
                        </Badge>
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
                      )}
                      {isOwnProfile && (
                        <Button variant="outline" onClick={() => setLocation("/dashboard")}>
                          Edit Profile
                        </Button>
                      )}
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
    </Layout>
  );
}
