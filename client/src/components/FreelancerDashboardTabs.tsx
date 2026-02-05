import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { usePersistentState } from "@/hooks/usePersistentState";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  BookOpen,
  Briefcase,
  Calendar,
  Camera,
  CheckCircle,
  Clock,
  PoundSterling,
  Mail,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  Upload,
  User,
  UserCheck,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CVUploader } from "./CVUploader";
import { MessagingInterface } from "./MessagingInterface";

interface Profile {
  id: string;
  role: "freelancer" | "recruiter";
  email: string;
}

interface FreelancerProfile {
  id?: string;
  user_id?: number;
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
  cv_file_name?: string;
  cv_file_type?: string;
  cv_file_size?: number;
  cv_file_url?: string;
}

interface FreelancerDashboardTabsProps {
  profile: Profile;
}

export function FreelancerDashboardTabs({ profile }: FreelancerDashboardTabsProps) {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const persistenceKey = `freelancer_profile_edit_${profile.id}`;

  const [freelancerProfile, setFreelancerProfile] = usePersistentState<FreelancerProfile>(
    persistenceKey,
    {
      first_name: "",
      last_name: "",
      title: "",
      bio: "",
      superpower: "",
      location: "",
      experience_years: null,
      skills: [],
      portfolio_url: "",
      linkedin_url: "",
      website_url: "",
      availability_status: "available",
      profile_photo_url: "",
    }
  );
  const [hasProfile, setHasProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newSkill, setNewSkill] = useState("");
  const [activeTab, setActiveTab] = useState("profile");
  const [lastViewedJobs, setLastViewedJobs] = useState<number>(() => {
    const stored = localStorage.getItem("freelancerLastViewedJobs");
    // For testing: use a much older timestamp to ensure notifications show
    return stored ? parseInt(stored) : Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
  });

  // Fetch unread message count with optimized polling
  const { data: unreadCount } = useQuery({
    queryKey: ["/api/messages/unread-count", profile.id],
    queryFn: () => apiRequest(`/api/messages/unread-count`),
    refetchInterval: activeTab === "messages" ? 15000 : 30000, // Poll faster only when on messages tab
    refetchIntervalInBackground: false, // Stop when tab is inactive
  });

  // Get user's job applications
  const { data: jobApplications = [], isLoading: applicationsLoading } = useQuery({
    queryKey: ["/api/freelancer/applications", profile.id],
    queryFn: async () => {
      const response = await fetch(`/api/freelancer/${profile.id}/applications`);
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error("Failed to fetch applications");
      }
      return response.json();
    },
    retry: false,
  });

  // Handle tab changes and mark as viewed
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    // Only update lastViewedJobs timestamp when actually viewing the content
    // This ensures the notification persists until the user sees the updated applications
  };

  // Function to mark job applications as viewed when user scrolls or interacts with content
  const markJobsAsViewed = () => {
    const now = Date.now();
    setLastViewedJobs(now);
    localStorage.setItem("freelancerLastViewedJobs", now.toString());
  };

  useEffect(() => {
    fetchFreelancerProfile();

    // Set active tab based on URL parameters and react to location changes
    const search = location.includes("?")
      ? location.split("?")[1]
      : window.location.search.replace(/^\?/, "");
    const urlParams = new URLSearchParams(search);
    const tabParam = urlParams.get("tab");
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [location]);

  const fetchFreelancerProfile = async () => {
    try {
      console.log("🔍 Fetching profile for user ID:", profile.id);
      const data = await apiRequest(`/api/freelancer/${profile.id}`);
      console.log("✅ Profile data received:", data);

      if (data) {
        // Check if we have a draft in storage. If we do, we prefer the draft (conceptually),
        // but usePersistentState has ALREADY initialized with it if it existed.
        // So we just rely on checking if `sessionStorage` has the key.
        const hasDraft = sessionStorage.getItem(persistenceKey);

        if (!hasDraft) {
          console.log(
            "Profile loaded, photo URL length:",
            data.profile_photo_url ? data.profile_photo_url.length : 0
          );
          console.log("CV data:", {
            fileName: data.cv_file_name,
            fileUrl: data.cv_file_url,
            fileSize: data.cv_file_size,
            fileType: data.cv_file_type,
          });
          setFreelancerProfile({
            id: data.id,
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
            cv_file_name: data.cv_file_name,
            cv_file_type: data.cv_file_type,
            cv_file_size: data.cv_file_size,
            cv_file_url: data.cv_file_url,
          });
        }
        setHasProfile(true);
      }
    } catch (error) {
      console.error("❌ Profile fetch error:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      setHasProfile(false);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const payload = {
        user_id: parseInt(profile.id),
        first_name: freelancerProfile.first_name,
        last_name: freelancerProfile.last_name,
        title: freelancerProfile.title,
        bio: freelancerProfile.bio,
        superpower: freelancerProfile.superpower,
        location: freelancerProfile.location,
        experience_years: freelancerProfile.experience_years,
        skills: freelancerProfile.skills,
        portfolio_url: freelancerProfile.portfolio_url,
        linkedin_url: freelancerProfile.linkedin_url,
        website_url: freelancerProfile.website_url,
        availability_status: freelancerProfile.availability_status,
        profile_photo_url: freelancerProfile.profile_photo_url,
      };

      console.log(
        "Saving profile with photo URL length:",
        payload.profile_photo_url ? payload.profile_photo_url.length : 0
      );

      if (hasProfile) {
        await apiRequest(`/api/freelancer/${profile.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        sessionStorage.removeItem(persistenceKey);
        toast({
          title: "Profile updated successfully!",
          description: "Your freelancer profile has been updated.",
        });
      } else {
        await apiRequest("/api/freelancer", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        sessionStorage.removeItem(persistenceKey);
        setHasProfile(true);
        toast({
          title: "Profile created successfully!",
          description: "Your freelancer profile has been created.",
        });
      }
    } catch (error) {
      console.error("Save error:", error);
      toast({
        title: "Error saving profile",
        description: "There was an error saving your profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const addSkill = () => {
    if (newSkill.trim() && !freelancerProfile.skills.includes(newSkill.trim())) {
      setFreelancerProfile((prev) => ({
        ...prev,
        skills: [...prev.skills, newSkill.trim()],
      }));
      setNewSkill("");
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setFreelancerProfile((prev) => ({
      ...prev,
      skills: prev.skills.filter((skill) => skill !== skillToRemove),
    }));
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        // 5MB limit
        toast({
          title: "File too large",
          description: "Please select an image under 5MB.",
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          // Resize to max 400x400 while maintaining aspect ratio
          const maxSize = 400;
          let { width, height } = img;

          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height;
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;

          ctx?.drawImage(img, 0, 0, width, height);

          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.8);
          console.log("Compressed image size:", compressedDataUrl.length, "characters");

          setFreelancerProfile((prev) => ({
            ...prev,
            profile_photo_url: compressedDataUrl,
          }));

          toast({
            title: "Photo uploaded successfully!",
            description: "Your profile photo has been updated. Remember to save your profile.",
          });
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  // Messages based on your actual profile as a Sound Engineer
  const profileMessages = [
    {
      id: 1,
      sender: "Live Nation Events",
      subject: `Sound Engineer - ${freelancerProfile.first_name} ${freelancerProfile.last_name}`,
      preview: `Hi ${freelancerProfile.first_name}, we saw your profile and are interested in your ${freelancerProfile.experience_years} years of experience...`,
      time: "2 hours ago",
      unread: true,
    },
    {
      id: 2,
      sender: "Corporate AV Solutions",
      subject: "Re: AV Specialist Position",
      preview: `Thank you for your interest in working with us on corporate events. Your expertise in ${freelancerProfile.skills[0] || "audio engineering"} is exactly what we need...`,
      time: "1 day ago",
      unread: false,
    },
    {
      id: 3,
      sender: "Conference Tech Ltd",
      subject: "Follow-up: Technical Director Role",
      preview: `Following our discussion about the ${freelancerProfile.location} event, we'd like to confirm your availability...`,
      time: "3 days ago",
      unread: false,
    },
  ];

  // Transform job applications data for display
  const profileJobs = jobApplications.map((application: any) => ({
    id: application.id,
    title: application.job?.title || "Job Title",
    company: application.job?.company || "Company",
    location: application.job?.location || "Location",
    date: application.job?.created_at
      ? new Date(application.job.created_at).toLocaleDateString()
      : "Date",
    rate: application.job?.rate || "Rate",
    status: application.status || "applied",
    applicationDate: application.created_at
      ? new Date(application.created_at).toLocaleDateString()
      : "",
    jobId: application.job_id,
    externalUrl: application.job?.external_url,
    rejectionMessage: application.rejection_message,
  }));

  // Get bookings (hired jobs) for the freelancer
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery<any[]>({
    queryKey: ["/api/freelancer", freelancerProfile?.user_id, "bookings"],
    enabled: !!freelancerProfile?.user_id,
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Profile Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-primary flex h-16 w-16 items-center justify-center overflow-hidden rounded-full">
                  {freelancerProfile.profile_photo_url &&
                  freelancerProfile.profile_photo_url.trim() !== "" &&
                  freelancerProfile.profile_photo_url !== "null" ? (
                    <img
                      src={freelancerProfile.profile_photo_url}
                      alt="Profile"
                      className="h-full w-full object-cover"
                      onLoad={() => console.log("Profile photo loaded successfully")}
                      onError={(e) => console.log("Profile photo failed to load:", e)}
                    />
                  ) : (
                    <User className="h-8 w-8 text-white" />
                  )}
                </div>
                <div>
                  <CardTitle className="text-2xl">
                    {hasProfile
                      ? `${freelancerProfile.first_name} ${freelancerProfile.last_name}`
                      : "Welcome to E8"}
                  </CardTitle>
                  <p className="text-muted-foreground">
                    {hasProfile ? freelancerProfile.title : "Let's create your freelancer profile"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`h-3 w-3 rounded-full ${
                    freelancerProfile.availability_status === "available"
                      ? "bg-green-500"
                      : freelancerProfile.availability_status === "busy"
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  }`}
                ></div>
                <Badge variant="outline" className="capitalize">
                  {freelancerProfile.availability_status}
                </Badge>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Tabbed Dashboard */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Edit Profile
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              <span>Messages</span>
              {unreadCount && Number(unreadCount.count) > 0 && (
                <Badge
                  variant="destructive"
                  className="ml-1 flex items-center justify-center text-xs"
                >
                  {Number(unreadCount.count)}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="jobs" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Jobs
              {(() => {
                const updatedApplications = jobApplications.filter(
                  (app: any) =>
                    ["rejected", "hired"].includes(app.status || "applied") &&
                    new Date(app.updated_at || app.applied_at).getTime() > lastViewedJobs
                );
                console.log("Notification check:", {
                  apps: jobApplications.length,
                  updatedApps: updatedApplications.length,
                  lastViewed: lastViewedJobs,
                  appTimes: jobApplications.map((app: any) => ({
                    id: app.id,
                    status: app.status,
                    updated: new Date(app.updated_at || app.applied_at).getTime(),
                  })),
                });
                return (
                  updatedApplications.length > 0 && (
                    <Badge variant="destructive" className="ml-1 px-1.5 py-0.5 text-xs">
                      {updatedApplications.length}
                    </Badge>
                  )
                );
              })()}
            </TabsTrigger>
            <TabsTrigger value="bookings" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Bookings
            </TabsTrigger>
          </TabsList>

          {/* Edit Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Profile Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Hidden file input */}
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />

                {/* Profile Photo Section */}
                <div className="flex items-start gap-4 rounded-lg border p-4">
                  <div className="bg-gradient-primary flex h-20 w-20 items-center justify-center overflow-hidden rounded-full">
                    {freelancerProfile.profile_photo_url &&
                    freelancerProfile.profile_photo_url.trim() !== "" &&
                    freelancerProfile.profile_photo_url !== "null" ? (
                      <img
                        src={freelancerProfile.profile_photo_url}
                        alt="Profile"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Camera className="h-8 w-8 text-white" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById("photo-upload")?.click()}
                        className="text-xs"
                      >
                        <Upload className="mr-1 h-3 w-3" />
                        {freelancerProfile.profile_photo_url ? "Change" : "Upload"}
                      </Button>
                    </div>
                    <div className="flex-1">
                      <h3 className="mb-2 text-lg font-semibold">Profile Photo</h3>
                      <p className="text-sm text-muted-foreground">
                        Upload a professional headshot to make your profile stand out. This will be
                        visible to recruiters and on your public profile.
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Recommended: Square image, at least 400x400 pixels
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name (Optional)</Label>
                    <Input
                      id="first_name"
                      value={freelancerProfile.first_name}
                      onChange={(e) =>
                        setFreelancerProfile((prev) => ({ ...prev, first_name: e.target.value }))
                      }
                      placeholder="Your first name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name (Optional)</Label>
                    <Input
                      id="last_name"
                      value={freelancerProfile.last_name}
                      onChange={(e) =>
                        setFreelancerProfile((prev) => ({ ...prev, last_name: e.target.value }))
                      }
                      placeholder="Your last name"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Professional Title (Optional)</Label>
                  <Input
                    id="title"
                    value={freelancerProfile.title}
                    onChange={(e) =>
                      setFreelancerProfile((prev) => ({ ...prev, title: e.target.value }))
                    }
                    placeholder="e.g., Sound Engineer, Lighting Technician, AV Specialist"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio (Optional)</Label>
                  <Textarea
                    id="bio"
                    value={freelancerProfile.bio}
                    onChange={(e) =>
                      setFreelancerProfile((prev) => ({ ...prev, bio: e.target.value }))
                    }
                    placeholder="Tell us about your experience and expertise..."
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="location">Location (Optional)</Label>
                    <Input
                      id="location"
                      value={freelancerProfile.location}
                      onChange={(e) =>
                        setFreelancerProfile((prev) => ({ ...prev, location: e.target.value }))
                      }
                      placeholder="City, Country"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="experience_years">Years of Experience (Optional)</Label>
                    <Input
                      id="experience_years"
                      type="number"
                      value={freelancerProfile.experience_years || ""}
                      onChange={(e) =>
                        setFreelancerProfile((prev) => ({
                          ...prev,
                          experience_years: e.target.value ? parseInt(e.target.value) : null,
                        }))
                      }
                      placeholder="5"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Skills (Optional)</Label>
                  <div className="mb-3 flex gap-2">
                    <Input
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      placeholder="Add a skill"
                      onKeyPress={(e) => e.key === "Enter" && addSkill()}
                    />
                    <Button onClick={addSkill} size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {freelancerProfile.skills.map((skill, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center gap-1">
                        {skill}
                        <X
                          className="h-3 w-3 cursor-pointer hover:text-destructive"
                          onClick={() => removeSkill(skill)}
                        />
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="portfolio_url">Portfolio URL</Label>
                    <Input
                      id="portfolio_url"
                      value={freelancerProfile.portfolio_url}
                      onChange={(e) =>
                        setFreelancerProfile((prev) => ({ ...prev, portfolio_url: e.target.value }))
                      }
                      placeholder="https://yourportfolio.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="linkedin_url">LinkedIn URL</Label>
                    <Input
                      id="linkedin_url"
                      value={freelancerProfile.linkedin_url}
                      onChange={(e) =>
                        setFreelancerProfile((prev) => ({ ...prev, linkedin_url: e.target.value }))
                      }
                      placeholder="https://linkedin.com/in/yourprofile"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website_url">Website URL</Label>
                    <Input
                      id="website_url"
                      value={freelancerProfile.website_url}
                      onChange={(e) =>
                        setFreelancerProfile((prev) => ({ ...prev, website_url: e.target.value }))
                      }
                      placeholder="https://yourwebsite.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="availability_status">Availability Status</Label>
                  <Select
                    value={freelancerProfile.availability_status}
                    onValueChange={(value: "available" | "busy" | "unavailable") =>
                      setFreelancerProfile((prev) => ({ ...prev, availability_status: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="busy">Busy</SelectItem>
                      <SelectItem value="unavailable">Unavailable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* CV Upload Section */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">CV/Resume</Label>
                  <CVUploader
                    userId={parseInt(profile.id)}
                    currentCV={
                      freelancerProfile.cv_file_name
                        ? {
                            fileName: freelancerProfile.cv_file_name,
                            fileType: freelancerProfile.cv_file_type,
                            fileSize: freelancerProfile.cv_file_size,
                            fileUrl: freelancerProfile.cv_file_url,
                          }
                        : undefined
                    }
                    onUploadComplete={() => {
                      // Refresh the profile data after CV upload
                      window.location.reload();
                    }}
                  />
                </div>

                <Button
                  onClick={saveProfile}
                  disabled={saving}
                  className="bg-gradient-primary hover:bg-primary-hover w-full"
                >
                  {saving ? "Saving..." : "Save Profile"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages" className="space-y-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Messages</h2>
                <p className="text-muted-foreground">
                  Create new connections and grow your network
                </p>
              </div>
            </div>
            <MessagingInterface
              initialConversationId={(() => {
                const params = new URLSearchParams(window.location.search);
                const conv =
                  params.get("conversation") ||
                  params.get("conversationId") ||
                  params.get("recipientId");
                return conv ? parseInt(conv, 10) : null;
              })()}
            />
          </TabsContent>

          {/* Jobs Tab */}
          <TabsContent
            value="jobs"
            className="space-y-6"
            onFocus={markJobsAsViewed}
            onClick={markJobsAsViewed}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Available Jobs & Applications
                </CardTitle>
              </CardHeader>
              <CardContent>
                {applicationsLoading ? (
                  <div className="py-8 text-center">Loading your applications...</div>
                ) : profileJobs.length === 0 ? (
                  <div className="space-y-4 py-8 text-center">
                    <div className="text-muted-foreground">
                      <Briefcase className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
                      <p className="text-lg font-medium">No job applications yet</p>
                      <p className="text-sm">
                        Start browsing jobs and apply to see your applications here.
                      </p>
                    </div>
                    <Button
                      onClick={() => setLocation("/jobs")}
                      className="bg-gradient-primary hover:bg-primary-hover"
                      data-testid="button-browse-jobs"
                    >
                      Browse Jobs
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {profileJobs.map((job: any) => (
                      <div key={job.id} className="rounded-lg border p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="mb-2 flex items-center gap-2">
                              <h4 className="font-semibold">{job.title}</h4>
                              <Badge
                                variant={
                                  job.status === "applied"
                                    ? "default"
                                    : job.status === "reviewed"
                                      ? "secondary"
                                      : job.status === "shortlisted"
                                        ? "default"
                                        : job.status === "rejected"
                                          ? "destructive"
                                          : job.status === "hired"
                                            ? "default"
                                            : "outline"
                                }
                                className={`text-xs ${
                                  job.status === "applied"
                                    ? "bg-blue-100 text-blue-800"
                                    : job.status === "reviewed"
                                      ? "bg-yellow-100 text-yellow-800"
                                      : job.status === "shortlisted"
                                        ? "bg-green-100 text-green-800"
                                        : job.status === "rejected"
                                          ? "bg-red-100 text-red-800"
                                          : job.status === "hired"
                                            ? "bg-purple-100 text-purple-800"
                                            : ""
                                }`}
                              >
                                {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                              </Badge>
                            </div>
                            <div className="space-y-1 text-sm text-muted-foreground">
                              <div className="flex items-center gap-4">
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {job.location}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Applied: {job.applicationDate}
                                </span>
                                <span className="flex items-center gap-1">
                                  <PoundSterling className="h-3 w-3" />
                                  {job.rate}
                                </span>
                              </div>
                              <p className="font-medium text-foreground">{job.company}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {job.externalUrl ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(job.externalUrl, "_blank")}
                                data-testid={`button-view-external-${job.id}`}
                              >
                                View on Site
                              </Button>
                            ) : job.status === "rejected" && job.rejectionMessage ? (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    data-testid={`button-view-details-${job.id}`}
                                  >
                                    View Details
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                  <DialogHeader>
                                    <DialogTitle>Application Declined</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                                      <div className="flex items-start space-x-3">
                                        <AlertCircle className="mt-0.5 h-5 w-5 text-red-500" />
                                        <div>
                                          <h4 className="font-medium text-red-800">
                                            Rejection Message
                                          </h4>
                                          <p className="mt-1 text-red-700">
                                            {job.rejectionMessage}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            ) : (
                              job.status !== "rejected" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  data-testid={`button-view-details-${job.id}`}
                                >
                                  View Details
                                </Button>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bookings Tab */}
          <TabsContent value="bookings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  My Bookings
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bookingsLoading ? (
                  <div className="space-y-4">
                    <div className="animate-pulse rounded-lg border p-4">
                      <div className="mb-2 h-4 w-1/3 rounded bg-gray-200"></div>
                      <div className="mb-1 h-3 w-1/2 rounded bg-gray-200"></div>
                      <div className="h-3 w-2/3 rounded bg-gray-200"></div>
                    </div>
                  </div>
                ) : bookings.length === 0 ? (
                  <div className="py-8 text-center">
                    <BookOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                    <h3 className="mb-2 text-lg font-medium text-muted-foreground">
                      No Bookings Yet
                    </h3>
                    <p className="mb-4 text-sm text-muted-foreground">
                      When you get hired for jobs, they'll appear here as confirmed bookings.
                    </p>
                    <Button variant="outline" onClick={() => setActiveTab("find-jobs")}>
                      <Search className="mr-2 h-4 w-4" />
                      Browse Jobs
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {bookings.map((booking: any) => (
                      <div key={booking.id} className="rounded-lg border p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="mb-2 flex items-center gap-2">
                              <h4 className="font-semibold">{booking.job_title}</h4>
                              <Badge
                                variant={
                                  booking.status === "confirmed"
                                    ? "default"
                                    : booking.status === "completed"
                                      ? "secondary"
                                      : "outline"
                                }
                                className={`text-xs ${booking.status === "confirmed" ? "bg-green-600" : ""}`}
                              >
                                <div className="flex items-center gap-1">
                                  {booking.status === "confirmed" && (
                                    <CheckCircle className="h-3 w-3" />
                                  )}
                                  {booking.status === "completed" && (
                                    <CheckCircle className="h-3 w-3" />
                                  )}
                                  {booking.status === "pending" && <Clock className="h-3 w-3" />}
                                  {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                                </div>
                              </Badge>
                            </div>
                            <div className="space-y-1 text-sm text-muted-foreground">
                              <div className="flex items-center gap-4">
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {booking.location}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {booking.event_date
                                    ? new Date(booking.event_date).toLocaleDateString()
                                    : "Date TBD"}
                                </span>
                                <span className="flex items-center gap-1">
                                  <PoundSterling className="h-3 w-3" />
                                  {booking.rate}
                                </span>
                              </div>
                              <p className="font-medium text-foreground">{booking.company_name}</p>
                              <p className="font-medium text-primary">
                                Hired on {new Date(booking.hired_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline">
                              <Mail className="mr-1 h-4 w-4" />
                              Contact
                            </Button>
                            <Button size="sm" variant="outline">
                              View Details
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
