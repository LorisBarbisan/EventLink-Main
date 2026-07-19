import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ProfileThemePicker } from "@/components/ProfileThemePicker";
import { CVParsingReview } from "@/components/CVParsingReview";
import { DocumentUploader } from "@/components/DocumentUploader";
import { ImageUpload } from "@/components/ImageUpload";
import { SimplifiedCVUploader } from "@/components/SimplifiedCVUploader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { CountrySelect } from "@/components/ui/country-select";
import { GlobalLocationInput } from "@/components/ui/global-location-input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useIsPro } from "@/hooks/useIsPro";
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
import {
  Building2,
  ChevronRight,
  FileText,
  Globe,
  Linkedin,
  MapPin,
  Plus,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { RatingDisplay } from "./StarRating";

const DRAFT_STORAGE_KEY_PREFIX = "eventlink_profile_draft_";

interface ProfileFormProps {
  profile?: FreelancerProfile | RecruiterProfile;
  userType: "freelancer" | "recruiter";
  onSave: (data: FreelancerFormData | RecruiterFormData) => Promise<void>;
  isSaving: boolean;
  /** When true (team members), company profile is view-only; only the owner may edit. */
  readOnly?: boolean;
}

export function ProfileForm({
  profile,
  userType,
  onSave,
  isSaving,
  readOnly = false,
}: ProfileFormProps) {
  const { user } = useAuth();
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
          country: freelancerProfile?.country || "",
          experience_years: freelancerProfile?.experience_years?.toString() || "",
          skills: freelancerProfile?.skills || [],
          portfolio_url: freelancerProfile?.portfolio_url || "",
          linkedin_url: freelancerProfile?.linkedin_url || "",
          website_url: freelancerProfile?.website_url || "",
          availability_status: freelancerProfile?.availability_status || "available",
          profile_photo_url: freelancerProfile?.profile_photo_url || "",
          phone: (freelancerProfile as any)?.phone || "",
          contact_email: (freelancerProfile as any)?.contact_email || "",
          card_dark_mode: !!(freelancerProfile as any)?.card_dark_mode,
          profile_theme: (freelancerProfile as any)?.profile_theme ?? {},
        } as FreelancerFormData;
      } else {
        const recruiterProfile = profileData as RecruiterProfile | undefined;
        return {
          company_name: recruiterProfile?.company_name || "",
          contact_name: recruiterProfile?.contact_name || "",
          company_type: recruiterProfile?.company_type || "",
          location: recruiterProfile?.location || "",
          country: recruiterProfile?.country || "",
          description: recruiterProfile?.description || "",
          website_url: recruiterProfile?.website_url || "",
          linkedin_url: recruiterProfile?.linkedin_url || "",
          company_logo_url: recruiterProfile?.company_logo_url || "",
        } as RecruiterFormData;
      }
    },
    [userType]
  );

  const [formData, setFormData] = usePersistentState<FreelancerFormData | RecruiterFormData>(
    draftKey,
    getDefaultFormData(profile)
  );
  const [newSkill, setNewSkill] = useState("");

  useEffect(() => {
    if (profile) {
      const hasDraft = sessionStorage.getItem(draftKey);
      if (!initialLoadDone.current) {
        const draftData = hasDraft ? JSON.parse(hasDraft) : null;
        const draftHasContent =
          draftData &&
          Object.values(draftData).some(
            (v) =>
              v &&
              (typeof v === "string" ? v.trim() !== "" : Array.isArray(v) ? v.length > 0 : true)
          );
        if (!draftHasContent) {
          setFormData(getDefaultFormData(profile));
        }
        initialLoadDone.current = true;
      } else if (!hasDraft) {
        setFormData(getDefaultFormData(profile));
      }
    }
  }, [profile, draftKey, getDefaultFormData, setFormData]);

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
    setFormData((prev) => ({
      ...prev,
      location: value,
      ...(locationData?.country ? { country: locationData.country } : {}),
    }));
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

  const { toast } = useToast();

  const freelancerRequiredValid =
    userType !== "freelancer" ||
    (() => {
      const fd = formData as FreelancerFormData;
      return !!(
        fd.first_name?.trim() &&
        fd.last_name?.trim() &&
        fd.title?.trim() &&
        fd.location?.trim() &&
        fd.country?.trim()
      );
    })();

  const handleSave = async () => {
    if (userType === "freelancer") {
      const fd = formData as FreelancerFormData;
      const missing: string[] = [];
      if (!fd.first_name?.trim()) missing.push("First Name");
      if (!fd.last_name?.trim()) missing.push("Last Name");
      if (!fd.title?.trim()) missing.push("Professional Title");
      if (!fd.location?.trim()) missing.push("Location");
      if (!fd.country?.trim()) missing.push("Country");
      if (missing.length > 0) {
        toast({
          title: "Required fields missing",
          description: `Please fill in: ${missing.join(", ")}`,
          variant: "destructive",
        });
        return;
      }
    }
    try {
      await onSave(formData);
      try {
        sessionStorage.removeItem(draftKey);
      } catch (e) {
        console.warn("Failed to clear draft:", e);
      }
    } catch {
      // Error toast is handled by the useProfile hook
    }
  };

  if (readOnly && !profile && userType === "recruiter") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Company Profile</CardTitle>
          <CardDescription>The company profile has not been set up yet.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Complete the company profile here before posting jobs.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (readOnly) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {userType === "freelancer" ? "Freelancer Profile" : "Company Profile"}
          </CardTitle>
          <CardDescription>
            {userType === "recruiter"
              ? "Company information (view only — contact the owner to make changes)"
              : "Your professional information and skills"}
          </CardDescription>
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
          setFormData(getDefaultFormData(profile));
          try {
            sessionStorage.removeItem(draftKey);
          } catch (e) {
            console.warn("Failed to clear draft:", e);
          }
          setShowConfirmDialog(false);
        }}
        onCancel={() => setShowConfirmDialog(false)}
        title="Unsaved Changes"
        description="You have unsaved changes. Are you sure you want to discard them?"
      />
      {userType === "freelancer" ? (
        <>
          <Tabs defaultValue="card">
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between">
                <CardTitle>{profile ? "Edit Profile" : "Create Freelancer Profile"}</CardTitle>
              </div>
              <TabsList className="mt-3 w-full justify-start border border-border bg-muted/60">
                <TabsTrigger
                  value="card"
                  className="font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow"
                >
                  Card &amp; Appearance
                </TabsTrigger>
                <TabsTrigger
                  value="profile"
                  className="font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow"
                >
                  Info &amp; Content
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="space-y-4 pt-4">
              <TabsContent value="profile" className="space-y-4">
                <FreelancerProfileFields
                  formData={formData as FreelancerFormData}
                  profile={profile as FreelancerProfile}
                  onInputChange={handleInputChange}
                  onLocationChange={handleLocationChange}
                  newSkill={newSkill}
                  setNewSkill={setNewSkill}
                  onSkillAdd={handleSkillAdd}
                  onSkillRemove={handleSkillRemove}
                  onFieldsConfirmed={(confirmedFields) => {
                    setFormData((prev) => {
                      const updated = { ...prev };
                      for (const [key, value] of Object.entries(confirmedFields)) {
                        if (value !== undefined && value !== null) {
                          (updated as any)[key] = value;
                        }
                      }
                      return updated;
                    });
                  }}
                />
                {user?.id && (
                  <div className="pt-2">
                    <DocumentUploader userId={user.id} isOwner={true} viewerRole="freelancer" />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="card" className="space-y-4">
                <FreelancerCardAppearanceFields
                  formData={formData as FreelancerFormData}
                  onInputChange={handleInputChange}
                />
              </TabsContent>

              <div className="flex gap-2 border-t pt-4">
                <Button
                  onClick={handleSave}
                  disabled={isSaving || !freelancerRequiredValid}
                  data-testid="button-save-profile"
                >
                  {isSaving ? "Saving..." : "Save Profile"}
                </Button>
                {profile && (
                  <Button
                    variant="outline"
                    onClick={() => setShowConfirmDialog(true)}
                    data-testid="button-cancel-edit"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Tabs>
        </>
      ) : (
        <>
          <CardHeader>
            <CardTitle>{profile ? "Edit Profile" : "Create Company Profile"}</CardTitle>
            <CardDescription>Update your company information and details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RecruiterFormFields
              formData={formData as RecruiterFormData}
              onInputChange={handleInputChange}
              onLocationChange={handleLocationChange}
            />
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-profile">
                {isSaving ? "Saving..." : "Save Profile"}
              </Button>
              {profile && (
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmDialog(true)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </>
      )}
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
              className="h-full w-full bg-white object-cover"
              onError={() => {
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
            <div className="mt-2 flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
              <span className="whiwhspace-nowrap teitespace-nowrap tex text-sm font-medium">
                Superpower:
              </span>
              <Badge className="max-w-full border-0 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                ⚡ {profile.superpower}
              </Badge>
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Badge
              variant="secondary"
              className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            >
              {profile.availability_status}
            </Badge>
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
          <span>{[profile.location, profile.country].filter(Boolean).join(", ")}</span>
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
              className="h-full w-full bg-white object-cover"
              onError={() => {
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
          <div className="mt-2 flex flex-wrap items-center gap-4 text-muted-foreground">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>{profile.location}</span>
            </div>
            {profile.website_url && (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                <a
                  href={(() => {
                    const u = profile.website_url.trim();
                    return u.match(/^https?:\/\//) ? u : `https://${u}`;
                  })()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Website
                </a>
              </div>
            )}
            {profile.linkedin_url && (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                <a
                  href={(() => {
                    const u = profile.linkedin_url.trim();
                    return u.match(/^https?:\/\//) ? u : `https://${u}`;
                  })()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  LinkedIn
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
      <Separator />
      {profile.description && (
        <div>
          <h4 className="mb-2 font-medium">About</h4>
          <p className="text-muted-foreground">{profile.description}</p>
        </div>
      )}
    </div>
  );
}

function FreelancerProfileFields({
  formData,
  profile,
  onInputChange,
  onLocationChange,
  newSkill,
  setNewSkill,
  onSkillAdd,
  onSkillRemove,
  onFieldsConfirmed,
}: {
  formData: FreelancerFormData;
  profile?: FreelancerProfile;
  onInputChange: (field: string, value: string) => void;
  onLocationChange: (value: string, locationData?: any) => void;
  newSkill: string;
  setNewSkill: (value: string) => void;
  onSkillAdd: () => void;
  onSkillRemove: (skill: string) => void;
  onFieldsConfirmed?: (fields: Record<string, any>) => void;
}) {
  return (
    <>
      {/* CV Upload — compact inline row */}
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
        <FileText className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-sm font-medium">CV / Resume</span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          Auto-fills your profile from your CV
        </span>
        <div className="ml-auto">
          <CVUploadSection
            profile={profile as FreelancerProfile}
            onFieldsConfirmed={onFieldsConfirmed}
          />
        </div>
      </div>

      <Separator className="my-6" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="first_name">First Name *</Label>
          <Input
            id="first_name"
            value={formData.first_name}
            onChange={(e) => onInputChange("first_name", e.target.value)}
            data-testid="input-first-name"
          />
        </div>
        <div>
          <Label htmlFor="last_name">Last Name *</Label>
          <Input
            id="last_name"
            value={formData.last_name}
            onChange={(e) => onInputChange("last_name", e.target.value)}
            data-testid="input-last-name"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="title">Professional Title *</Label>
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="country">Country *</Label>
          <CountrySelect
            id="country"
            value={formData.country}
            onChange={(v) => onInputChange("country", v)}
            required
          />
        </div>
        <GlobalLocationInput
          id="location"
          label="City / Location *"
          value={formData.location}
          onChange={onLocationChange}
          placeholder="Start typing a city..."
          data-testid="input-location"
          required
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

function CardLivePreview({
  formData,
  theme,
}: {
  formData: FreelancerFormData;
  theme: {
    accent?: string;
    button_color?: string;
    button_text?: "auto" | "light" | "dark";
    font?: string;
  };
}) {
  const [flipped, setFlipped] = useState(false);

  const FONT_CSS_MAP: Record<string, string> = {
    inter: "Inter, sans-serif",
    playfair: "'Playfair Display', serif",
    poppins: "Poppins, sans-serif",
    "space-grotesk": "'Space Grotesk', sans-serif",
  };
  const accent = theme.accent ?? "#f97316";
  const buttonColor = theme.button_color ?? "#ffffff";
  const buttonTextPref = theme.button_text ?? "auto";
  const fontFamily = FONT_CSS_MAP[theme.font ?? "inter"] ?? "Inter, sans-serif";
  const firstName = formData.first_name || "Your";
  const lastName = formData.last_name || "Name";
  const title = formData.title || "Professional Title";
  const photo = formData.profile_photo_url;

  // Luminance for back-of-card text contrast
  const lum = (() => {
    if (!accent.startsWith("#")) return 0.3;
    const h = accent.replace("#", "");
    if (h.length < 6) return 0.3;
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    return 0.299 * r + 0.587 * g + 0.114 * b;
  })();
  const isDark = lum < 0.7;
  const onAccent = isDark ? "#fff" : "#111";
  const onAccentSub = isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.55)";

  // Button text colour — respect manual override, fall back to luminance
  const btnLum = (() => {
    if (!buttonColor.startsWith("#")) return 0.9;
    const h = buttonColor.replace("#", "");
    if (h.length < 6) return 0.9;
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    return 0.299 * r + 0.587 * g + 0.114 * b;
  })();
  const btnDark = buttonTextPref === "dark" || (buttonTextPref === "auto" && btnLum > 0.5);
  const onBtn = btnDark ? "#111" : "#fff";
  const onBtnSub = btnDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.7)";
  const btnBorder = btnDark ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.25)";

  const sections = [
    { icon: <User style={{ width: 15, height: 15 }} />, label: "About", sub: "Overview & intro" },
    {
      icon: <ShieldCheck style={{ width: 15, height: 15 }} />,
      label: "Credentials",
      sub: "Verified & endorsed",
    },
    { icon: <FileText style={{ width: 15, height: 15 }} />, label: "Files", sub: "CV & documents" },
    ...(formData.linkedin_url
      ? [
          {
            icon: <Linkedin style={{ width: 15, height: 15 }} />,
            label: "LinkedIn",
            sub: "View profile",
          },
        ]
      : []),
    ...(formData.website_url
      ? [
          {
            icon: <Globe style={{ width: 15, height: 15 }} />,
            label: "Website",
            sub: "Visit website",
          },
        ]
      : []),
  ];

  return (
    <div style={{ fontFamily }}>
      {/* Flip hint */}
      <p className="mb-1 text-center text-xs text-muted-foreground">
        {flipped ? "← Tap to see front" : "Tap to see back →"}
      </p>

      {/* 3-D flip scene */}
      <div onClick={() => setFlipped((f) => !f)} style={{ perspective: 900, cursor: "pointer" }}>
        <div
          style={{
            position: "relative",
            transformStyle: "preserve-3d",
            transition: "transform 0.55s cubic-bezier(.4,0,.2,1)",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            borderRadius: 18,
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            minHeight: 340,
          }}
        >
          {/* ── FRONT ── */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              background: "#fff",
              borderRadius: 18,
              border: "1px solid #e0e0e8",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "20px 16px 16px",
            }}
          >
            {/* NFC dot — grey, matching real card */}
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#f7f7f8",
                border: "1.5px solid #e0e0e8",
                marginBottom: 14,
              }}
            />
            {/* avatar — accent ring is the only front-face colour hint */}
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "linear-gradient(135deg,#b8cce0,#7a93a8)",
                border: `2.5px solid ${accent}`,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                color: "#fff",
                fontWeight: 700,
                marginBottom: 10,
              }}
            >
              {photo && photo !== "null" && photo.trim() ? (
                <img
                  src={photo}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                `${(firstName[0] ?? "").toUpperCase()}${(lastName[0] ?? "").toUpperCase()}`
              )}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111", marginBottom: 3 }}>
              {firstName} {lastName}
            </div>
            <div style={{ fontSize: 11, color: "#555", marginBottom: 10 }}>{title}</div>
            <div style={{ width: "100%", height: 1, background: "#f0f0f4", marginBottom: 10 }} />
            {/* Contact details — centred */}
            {(formData.phone || formData.contact_email) && (
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 7,
                  margin: "4px 0 8px",
                }}
              >
                {formData.phone && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "#111",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      fontWeight: 500,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>📞</span> {formData.phone}
                  </div>
                )}
                {formData.contact_email && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "#111",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      fontWeight: 500,
                      wordBreak: "break-all",
                      textAlign: "center",
                    }}
                  >
                    <span style={{ fontSize: 14 }}>✉️</span> {formData.contact_email}
                  </div>
                )}
              </div>
            )}
            <div
              style={{
                marginTop: "auto",
                fontSize: 10,
                color: "#999",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
              }}
            >
              📍 {[formData.location, formData.country].filter(Boolean).join(", ") || "Location"}
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "hsl(27,88%,45%)",
                letterSpacing: "-0.3px",
                marginTop: 7,
              }}
            >
              EventLink
            </div>
          </div>

          {/* ── BACK ── */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              background: accent,
              borderRadius: 18,
              display: "flex",
              flexDirection: "column",
              padding: "16px 14px 14px",
            }}
          >
            {/* Header row */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  border: `2px solid ${btnBorder}`,
                  background: buttonColor,
                  overflow: "hidden",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                }}
              >
                {photo && photo !== "null" && photo.trim() ? (
                  <img
                    src={photo}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  "👤"
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: onAccent,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {firstName} {lastName}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: onAccentSub,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {title}
                </div>
              </div>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: "hsl(27,88%,45%)",
                  flexShrink: 0,
                  background: "rgba(255,255,255,0.92)",
                  borderRadius: 20,
                  padding: "2px 7px",
                  border: "1px solid rgba(255,255,255,0.6)",
                }}
              >
                EventLink
              </span>
            </div>

            {/* Section buttons */}
            <div style={{ flex: 1 }}>
              {sections.map((s) => (
                <div
                  key={s.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: buttonColor,
                    border: `1px solid ${btnBorder}`,
                    borderRadius: 12,
                    padding: "8px 10px",
                    marginBottom: 6,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      color: onBtn,
                    }}
                  >
                    {s.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: onBtn }}>{s.label}</div>
                    <div style={{ fontSize: 9, color: onBtnSub }}>{s.sub}</div>
                  </div>
                  <ChevronRight
                    style={{
                      marginLeft: "auto",
                      width: 12,
                      height: 12,
                      color: onBtn,
                      opacity: 0.4,
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Action bar */}
            <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
              <div
                style={{
                  flex: 1,
                  padding: "7px 4px",
                  background: buttonColor,
                  border: `1px solid ${btnBorder}`,
                  borderRadius: 20,
                  fontSize: 10,
                  color: onBtn,
                  fontWeight: 700,
                  textAlign: "center",
                }}
              >
                🔗 Share
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FreelancerCardAppearanceFields({
  formData,
  onInputChange,
}: {
  formData: FreelancerFormData;
  onInputChange: (field: string, value: any) => void;
}) {
  const isPro = useIsPro();
  const theme = (formData as any).profile_theme ?? {};

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_260px]">
      {/* Left: Controls */}
      <div className="space-y-6">
        <div>
          <h3 className="text-base font-semibold">Appearance</h3>
          <p className="text-sm text-muted-foreground">
            Choose your accent colour, profile font, and the order of public sections.
          </p>
        </div>

        {isPro && (
          <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-sm font-semibold">Business Card Contact Details</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone || ""}
                  onChange={(e) => onInputChange("phone", e.target.value)}
                  placeholder="+44 7911 123456"
                />
              </div>
              <div>
                <Label htmlFor="contact_email">Contact Email</Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={formData.contact_email || ""}
                  onChange={(e) => onInputChange("contact_email", e.target.value)}
                  placeholder="hello@yourname.com"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              These appear on the back of your shared business card.
            </p>
          </div>
        )}

        <ProfileThemePicker theme={theme} onChange={(t) => onInputChange("profile_theme", t)} />
      </div>

      {/* Right: Live Preview */}
      <div className="self-start lg:sticky lg:top-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Live Preview
        </p>
        <CardLivePreview formData={formData} theme={theme} />
      </div>
    </div>
  );
}

// CV Upload section for freelancers when editing their profile
function CVUploadSection({
  profile,
  onFieldsConfirmed,
}: {
  profile?: FreelancerProfile;
  onFieldsConfirmed?: (fields: Record<string, any>) => void;
}) {
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
    <div className="min-w-0 space-y-4">
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
        onFieldsConfirmed={onFieldsConfirmed}
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
          <GlobalLocationInput
            id="location"
            label="City / Location"
            value={formData.location}
            onChange={onLocationChange}
            placeholder="Start typing a city..."
            data-testid="input-location"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="country">Country</Label>
        <CountrySelect
          id="country"
          value={formData.country}
          onChange={(v) => onInputChange("country", v)}
        />
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
