import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CVParsingReview } from "@/components/CVParsingReview";
import { ImageUpload } from "@/components/ImageUpload";
import { SimplifiedCVUploader } from "@/components/SimplifiedCVUploader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { UKLocationInput } from "@/components/ui/uk-location-input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useFreelancerAverageRating } from "@/hooks/useRatings";
import { apiRequest } from "@/lib/queryClient";
import type {
  FreelancerFormData,
  FreelancerProfile,
  RecruiterFormData,
  RecruiterProfile,
} from "@shared/types";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Globe, MapPin, Plus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { RatingDisplay } from "./StarRating";

const DRAFT_STORAGE_KEY_PREFIX = "eventlink_profile_draft_";

interface ProfileFormProps {
  profile?: FreelancerProfile | RecruiterProfile;
  userType: "freelancer" | "recruiter";
  onSave: (data: FreelancerFormData | RecruiterFormData) => void;
  isSaving: boolean;
}

export function ProfileForm({ profile, userType, onSave, isSaving }: ProfileFormProps) {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const draftKey = user?.id
    ? `${DRAFT_STORAGE_KEY_PREFIX}${userType}_${user.id}`
    : "profile_draft_temp";
  const initialLoadDone = useRef(false);

  const getDefaultFormData = useCallback(
    (
      profileData?: FreelancerProfile | RecruiterProfile
    ): FreelancerFormData | RecruiterFormData => {
      if (userType === "freelancer") {
        const freelancerProfile = profileData as FreelancerProfile | undefined;
        return {
          first_name: freelancerProfile?.first_name || "",
          last_name: freelancerProfile?.last_name || "",
          title: freelancerProfile?.title || "",
          superpower: freelancerProfile?.superpower || "",
          bio: freelancerProfile?.bio || "",
          location: freelancerProfile?.location || "",
          experience_years: freelancerProfile?.experience_years?.toString() || "",
          skills: freelancerProfile?.skills || [],
          portfolio_url: freelancerProfile?.portfolio_url || "",
          linkedin_url: freelancerProfile?.linkedin_url || "",
          website_url: freelancerProfile?.website_url || "",
          availability_status: freelancerProfile?.availability_status || "available",
          profile_photo_url: freelancerProfile?.profile_photo_url || "",
        } as FreelancerFormData;
      } else {
        const recruiterProfile = profileData as RecruiterProfile | undefined;
        return {
          company_name: recruiterProfile?.company_name || "",
          contact_name: recruiterProfile?.contact_name || "",
          company_type: recruiterProfile?.company_type || "",
          location: recruiterProfile?.location || "",
          description: recruiterProfile?.description || "",
          website_url: recruiterProfile?.website_url || "",
          linkedin_url: recruiterProfile?.linkedin_url || "",
          company_logo_url: recruiterProfile?.company_logo_url || "",
        } as RecruiterFormData;
      }
    },
    [userType]
  );

  const [formData, setFormData, , isDirty] = usePersistentState<
    FreelancerFormData | RecruiterFormData
  >(draftKey, getDefaultFormData(profile));
  const [newSkill, setNewSkill] = useState("");

  useEffect(() => {
    if (profile) {
      // If we have a draft, ignore profile updates until draft is cleared
      const hasDraft = sessionStorage.getItem(draftKey);
      if (!hasDraft && !isEditing) {
        // Only sync from profile when not editing or no draft exists
        setFormData(getDefaultFormData(profile));
      } else if (!initialLoadDone.current) {
        // Initial load: if no draft, load profile
        if (!hasDraft) {
          setFormData(getDefaultFormData(profile));
        }
        initialLoadDone.current = true;
      }
    }
  }, [profile, draftKey, getDefaultFormData, setFormData, isEditing]);

  const handleInputChange = (field: string, value: string) => {
    console.log("ProfileForm handleInputChange:", {
      field,
      valueLength: value.length,
      isImageUpload: field.includes("url"),
    });
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLocationChange = (value: string, locationData?: any) => {
    console.log("ProfileForm handleLocationChange:", { value, locationData });
    setFormData((prev) => ({ ...prev, location: value }));
  };

  const handleSkillAdd = () => {
    if (newSkill.trim() && userType === "freelancer") {
      const freelancerData = formData as FreelancerFormData;
      if (!freelancerData.skills.includes(newSkill.trim())) {
        setFormData((prev) => ({
          ...prev,
          skills: [...freelancerData.skills, newSkill.trim()],
        }));
        setNewSkill("");
      }
    }
  };

  const handleSkillRemove = (skillToRemove: string) => {
    if (userType === "freelancer") {
      const freelancerData = formData as FreelancerFormData;
      setFormData((prev) => ({
        ...prev,
        skills: freelancerData.skills.filter((skill) => skill !== skillToRemove),
      }));
    }
  };

  const handleSave = () => {
    onSave(formData);
    // Clear the draft from storage but keep the form data in state
    // This allows the user to see their changes immediately while the background refresh happens
    try {
      sessionStorage.removeItem(draftKey);
    } catch (e) {
      console.warn("Failed to clear draft:", e);
    }
  };

  if (!isEditing && profile) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {userType === "freelancer" ? "Freelancer Profile" : "Company Profile"}
              </CardTitle>
              <CardDescription>
                {userType === "freelancer"
                  ? "Your professional information and skills"
                  : "Your company information and details"}
              </CardDescription>
            </div>
            <Button onClick={() => setIsEditing(true)} data-testid="button-edit-profile">
              Edit Profile
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {userType === "freelancer" ? (
            <FreelancerProfileView profile={profile as FreelancerProfile} />
          ) : (
            <RecruiterProfileView profile={profile as RecruiterProfile} />
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <ConfirmDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        onConfirm={() => {
          // Reset to profile data
          setFormData(getDefaultFormData(profile));
          try {
            sessionStorage.removeItem(draftKey);
          } catch (e) {
            console.warn("Failed to clear draft:", e);
          }
          setShowConfirmDialog(false);
          setIsEditing(false);
        }}
        onCancel={() => setShowConfirmDialog(false)}
        title="Unsaved Changes"
        description="You have unsaved changes. Are you sure you want to discard them and stop editing?"
      />
      <CardHeader>
        <CardTitle>
          {profile
            ? "Edit Profile"
            : `Create ${userType === "freelancer" ? "Freelancer" : "Company"} Profile`}
        </CardTitle>
        <CardDescription>
          {userType === "freelancer"
            ? "Update your professional information and skills"
            : "Update your company information and details"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {userType === "freelancer" ? (
          <FreelancerFormFields
            formData={formData as FreelancerFormData}
            profile={profile as FreelancerProfile}
            onInputChange={handleInputChange}
            onLocationChange={handleLocationChange}
            newSkill={newSkill}
            setNewSkill={setNewSkill}
            onSkillAdd={handleSkillAdd}
            onSkillRemove={handleSkillRemove}
          />
        ) : (
          <RecruiterFormFields
            formData={formData as RecruiterFormData}
            onInputChange={handleInputChange}
            onLocationChange={handleLocationChange}
          />
        )}

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-profile">
            {isSaving ? "Saving..." : "Save Profile"}
          </Button>
          {profile && (
            <Button
              variant="outline"
              onClick={() => {
                if (isDirty) {
                  setShowConfirmDialog(true);
                } else {
                  setIsEditing(false);
                }
              }}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FreelancerProfileView({ profile }: { profile: FreelancerProfile }) {
  const { data: averageRating } = useFreelancerAverageRating((profile as any).user_id);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="bg-gradient-primary flex h-16 w-16 items-center justify-center overflow-hidden rounded-full">
          {profile.profile_photo_url &&
          profile.profile_photo_url.trim() !== "" &&
          profile.profile_photo_url !== "null" ? (
            <img
              src={profile.profile_photo_url}
              alt="Profile"
              className="h-full w-full object-cover"
              onError={(e) => {
                console.log(
                  "Profile photo failed to load:",
                  profile.profile_photo_url?.substring(0, 50)
                );
              }}
            />
          ) : (
            <span className="h-8 w-8 text-2xl text-white">👤</span>
          )}
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-semibold">
            {profile.first_name} {profile.last_name}
          </h3>
          <p className="text-muted-foreground">{profile.title}</p>
          {profile.superpower && (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Superpower:</span>
              <Badge className="border-0 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                ⚡ {profile.superpower}
              </Badge>
            </div>
          )}
          <div className="mt-1 flex items-center gap-3">
            <Badge variant="secondary">{profile.availability_status}</Badge>
            {averageRating && (
              <RatingDisplay
                average={averageRating.average}
                count={averageRating.count}
                size="sm"
                data-testid={`rating-display-${profile.user_id}`}
              />
            )}
          </div>
        </div>
      </div>
      <Separator />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span>{profile.location}</span>
        </div>
      </div>
      {profile.bio && (
        <div>
          <h4 className="mb-2 font-medium">About</h4>
          <p className="text-muted-foreground">{profile.bio}</p>
        </div>
      )}
      {profile.skills && profile.skills.length > 0 && (
        <div>
          <h4 className="mb-2 font-medium">Skills</h4>
          <div className="flex flex-wrap gap-2">
            {profile.skills.map((skill, index) => (
              <Badge key={index} variant="outline">
                {skill}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RecruiterProfileView({ profile }: { profile: RecruiterProfile }) {
  const [logoError, setLogoError] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="bg-gradient-primary flex h-16 w-16 items-center justify-center overflow-hidden rounded-full">
          {profile.company_logo_url &&
          profile.company_logo_url.trim() !== "" &&
          profile.company_logo_url !== "null" &&
          !logoError ? (
            <img
              src={profile.company_logo_url}
              alt={`${profile.company_name} logo`}
              className="h-full w-full object-cover"
              onError={(e) => {
                console.log(
                  "Company logo failed to load:",
                  profile.company_logo_url?.substring(0, 50)
                );
                setLogoError(true);
              }}
              onLoad={() => setLogoError(false)}
            />
          ) : (
            <Building2 className="h-8 w-8 text-white" />
          )}
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-semibold">{profile.company_name}</h3>
          <p className="text-muted-foreground">{profile.contact_name}</p>
          <div className="mt-1 flex items-center gap-3">
            <Badge variant="secondary">{profile.company_type}</Badge>
          </div>
        </div>
      </div>
      <Separator />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span>{profile.location}</span>
        </div>
        {profile.website_url && (
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <a
              href={profile.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Website
            </a>
          </div>
        )}
      </div>
      {profile.description && (
        <div>
          <h4 className="mb-2 font-medium">About</h4>
          <p className="text-muted-foreground">{profile.description}</p>
        </div>
      )}
    </div>
  );
}

function FreelancerFormFields({
  formData,
  profile,
  onInputChange,
  onLocationChange,
  newSkill,
  setNewSkill,
  onSkillAdd,
  onSkillRemove,
}: {
  formData: FreelancerFormData;
  profile?: FreelancerProfile;
  onInputChange: (field: string, value: string) => void;
  onLocationChange: (value: string, locationData?: any) => void;
  newSkill: string;
  setNewSkill: (value: string) => void;
  onSkillAdd: () => void;
  onSkillRemove: (skill: string) => void;
}) {
  return (
    <>
      {/* CV Upload Section - Moved to top with clear messaging */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Quick Profile Setup with CV
          </CardTitle>
          <CardDescription>
            Upload your CV and we'll automatically extract your skills, experience, and contact details to fill in your profile. You can review and edit the suggestions before applying them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CVUploadSection profile={profile as FreelancerProfile} />
        </CardContent>
      </Card>

      <Separator className="my-6" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="first_name">First Name (Optional)</Label>
          <Input
            id="first_name"
            value={formData.first_name}
            onChange={(e) => onInputChange("first_name", e.target.value)}
            data-testid="input-first-name"
          />
        </div>
        <div>
          <Label htmlFor="last_name">Last Name (Optional)</Label>
          <Input
            id="last_name"
            value={formData.last_name}
            onChange={(e) => onInputChange("last_name", e.target.value)}
            data-testid="input-last-name"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="title">Professional Title (Optional)</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => onInputChange("title", e.target.value)}
          placeholder="e.g. Senior Sound Engineer"
          data-testid="input-title"
        />
      </div>

      <div>
        <Label htmlFor="superpower">Superpower (One standout skill)</Label>
        <Input
          id="superpower"
          value={formData.superpower}
          onChange={(e) => {
            if (e.target.value.length <= 40) {
              onInputChange("superpower", e.target.value);
            }
          }}
          placeholder="Enter one standout skill – e.g. Client-facing, vMix operator, RF specialist"
          data-testid="input-superpower"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          <strong>Best Practice:</strong> Keep it short (max 40 chars). Focus on your #1 strength
          recruiters should notice first. Avoid lists or generic terms like
          &quot;hard-working&quot;.
        </p>
      </div>

      <div>
        <Label htmlFor="bio">Bio (Optional)</Label>
        <Textarea
          id="bio"
          value={formData.bio}
          onChange={(e) => onInputChange("bio", e.target.value)}
          placeholder="Tell us about your experience and expertise..."
          rows={3}
          data-testid="textarea-bio"
        />
      </div>

      <div>
        <UKLocationInput
          id="location"
          label="Location (Optional)"
          value={formData.location}
          onChange={onLocationChange}
          placeholder="Start typing a UK location..."
          data-testid="input-location"
        />
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <Label htmlFor="experience_years">Years of Experience (Optional)</Label>
          <Input
            id="experience_years"
            type="number"
            value={formData.experience_years}
            onChange={(e) => onInputChange("experience_years", e.target.value)}
            placeholder="0"
            data-testid="input-experience-years"
          />
        </div>
      </div>

      <div>
        <Label>Skills (Optional)</Label>
        <div className="mb-2 flex gap-2">
          <Input
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            placeholder="Add a skill"
            onKeyPress={(e) => e.key === "Enter" && onSkillAdd()}
            data-testid="input-new-skill"
          />
          <Button type="button" onClick={onSkillAdd} data-testid="button-add-skill">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {formData.skills.map((skill, index) => (
            <Badge key={index} variant="secondary" className="flex items-center gap-1">
              {skill}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onSkillRemove(skill)}
                data-testid={`button-remove-skill-${skill}`}
              />
            </Badge>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="availability_status">Availability Status</Label>
        <Select
          value={formData.availability_status}
          onValueChange={(value) => onInputChange("availability_status", value)}
        >
          <SelectTrigger data-testid="select-availability">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="busy">Busy</SelectItem>
            <SelectItem value="unavailable">Unavailable</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="portfolio_url">Portfolio URL</Label>
          <Input
            id="portfolio_url"
            type="url"
            value={formData.portfolio_url}
            onChange={(e) => onInputChange("portfolio_url", e.target.value)}
            placeholder="https://yourportfolio.com"
            data-testid="input-portfolio-url"
          />
        </div>
        <div>
          <Label htmlFor="linkedin_url">LinkedIn URL</Label>
          <Input
            id="linkedin_url"
            type="url"
            value={formData.linkedin_url}
            onChange={(e) => onInputChange("linkedin_url", e.target.value)}
            placeholder="https://linkedin.com/in/yourprofile"
            data-testid="input-linkedin-url"
          />
        </div>
      </div>

      <div>
        <ImageUpload
          label="Profile Photo (Optional)"
          value={formData.profile_photo_url}
          onChange={(url: string) => onInputChange("profile_photo_url", url)}
          shape="circle"
        />
      </div>

    </>
  );
}

// CV Upload section for freelancers when editing their profile
function CVUploadSection({ profile }: { profile?: FreelancerProfile }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Only show if user is a freelancer
  if (!user || user.role !== "freelancer") {
    return null;
  }

  const handleUploadComplete = async (updatedProfile?: any) => {
    console.log("🔄 CV upload/delete complete for user:", user.id);

    // Use the profile from the response (already fresh from DB)
    if (updatedProfile) {
      queryClient.setQueryData(["/api/freelancer/profile", user.id], updatedProfile);
      console.log("✅ Profile updated in cache from response:", updatedProfile);

      toast({
        title: "Success",
        description: "Your CV has been updated successfully!",
      });
    } else {
      console.warn("No profile in response, falling back to refetch");
      // Fallback: refetch if no profile provided
      try {
        const freshProfile = await apiRequest(`/api/freelancer/${user.id}`);
        queryClient.setQueryData(["/api/freelancer/profile", user.id], freshProfile);
        console.log("✅ Profile fetched and updated in cache:", freshProfile);
      } catch (error) {
        console.error("Failed to fetch updated profile:", error);
      }
    }
  };

  // Prepare current CV data for CVUploader
  const currentCV =
    profile && profile.cv_file_url
      ? {
          fileName: profile.cv_file_name,
          fileType: profile.cv_file_type,
          fileSize: profile.cv_file_size,
          fileUrl: profile.cv_file_url,
        }
      : undefined;

  return (
    <div className="space-y-4">
      <SimplifiedCVUploader
        userId={user.id}
        currentCV={currentCV}
        onUploadComplete={handleUploadComplete}
      />
      <CVParsingReview
        onProfileUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/freelancer", user.id] });
          queryClient.invalidateQueries({ queryKey: ["/api/freelancer/profile", user.id] });
        }}
      />
    </div>
  );
}

function RecruiterFormFields({
  formData,
  onInputChange,
  onLocationChange,
}: {
  formData: RecruiterFormData;
  onInputChange: (field: string, value: string) => void;
  onLocationChange: (value: string, locationData?: any) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="company_name">Company Name</Label>
          <Input
            id="company_name"
            value={formData.company_name}
            onChange={(e) => onInputChange("company_name", e.target.value)}
            data-testid="input-company-name"
          />
        </div>
        <div>
          <Label htmlFor="contact_name">Contact Name</Label>
          <Input
            id="contact_name"
            value={formData.contact_name}
            onChange={(e) => onInputChange("contact_name", e.target.value)}
            data-testid="input-contact-name"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="company_type">Company Type</Label>
          <Select
            value={formData.company_type}
            onValueChange={(value) => onInputChange("company_type", value)}
          >
            <SelectTrigger data-testid="select-company-type">
              <SelectValue placeholder="Select company type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="production_company">Production Company</SelectItem>
              <SelectItem value="agency">Agency</SelectItem>
              <SelectItem value="av_supplier">AV Supplier</SelectItem>
              <SelectItem value="venue">Venue</SelectItem>
              <SelectItem value="exhibition_trade_show_organiser">
                Exhibition & Trade Show Organiser
              </SelectItem>
              <SelectItem value="entertainment_agency">Entertainment Agency</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <UKLocationInput
            id="location"
            label="Location"
            value={formData.location}
            onChange={onLocationChange}
            placeholder="Start typing a UK location..."
            data-testid="input-location"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Company Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => onInputChange("description", e.target.value)}
          placeholder="Tell us about your company..."
          rows={3}
          data-testid="textarea-description"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="website_url">Website URL</Label>
          <Input
            id="website_url"
            type="url"
            value={formData.website_url}
            onChange={(e) => onInputChange("website_url", e.target.value)}
            placeholder="https://yourcompany.com"
            data-testid="input-website-url"
          />
        </div>
        <div>
          <Label htmlFor="linkedin_url">LinkedIn URL</Label>
          <Input
            id="linkedin_url"
            type="url"
            value={formData.linkedin_url}
            onChange={(e) => onInputChange("linkedin_url", e.target.value)}
            placeholder="https://linkedin.com/company/yourcompany"
            data-testid="input-linkedin-url"
          />
        </div>
      </div>

      <div>
        <ImageUpload
          label="Company Logo"
          value={formData.company_logo_url}
          onChange={(url: string) => onInputChange("company_logo_url", url)}
          shape="circle"
        />
      </div>
    </>
  );
}
