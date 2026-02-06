import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { UKLocationInput } from "@/components/ui/uk-location-input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { JobAlertFilter, User } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bell, Briefcase, Filter, Mail, MessageSquare, Plus, Star, X } from "lucide-react";
import { useEffect, useState } from "react";

interface NotificationSettingsFormProps {
  user: User;
}

interface NotificationPreferences {
  id: number;
  user_id: number;
  email_messages: boolean;
  email_application_updates: boolean;
  email_job_updates: boolean;
  email_job_alerts: boolean;
  email_rating_requests: boolean;
  email_system_updates: boolean;
  digest_mode: "instant" | "daily" | "weekly";
  digest_time: string;
}

export function NotificationSettingsForm({ user }: NotificationSettingsFormProps) {
  const { toast } = useToast();
  const [localPreferences, setLocalPreferences] = useState<NotificationPreferences | null>(null);

  // Job alert filter state
  const [skillInput, setSkillInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterSkills, setFilterSkills] = useState<string[]>([]);
  const [filterLocations, setFilterLocations] = useState<string[]>([]);
  const [filterKeywords, setFilterKeywords] = useState<string[]>([]);
  const [locationRadiusKm, setLocationRadiusKm] = useState<number>(30);

  // Fetch notification preferences
  const { data: preferences, isLoading } = useQuery<NotificationPreferences>({
    queryKey: ["/api/notifications/settings"],
  });

  // Fetch job alert filters (freelancers only)
  const { data: jobAlertFilter } = useQuery<JobAlertFilter>({
    queryKey: ["/api/notifications/job-alerts"],
    enabled: user.role === "freelancer",
  });

  // Update local state when preferences are loaded
  useEffect(() => {
    if (preferences) {
      setLocalPreferences(preferences);
    }
  }, [preferences]);

  // Update filter state when job alert filter is loaded
  useEffect(() => {
    if (jobAlertFilter) {
      setFilterSkills(jobAlertFilter.skills || []);
      setFilterLocations(jobAlertFilter.locations || []);
      setFilterKeywords(jobAlertFilter.keywords || []);
      setLocationRadiusKm(jobAlertFilter.location_radius_km ?? 30);
      setDateFrom(jobAlertFilter.date_from || "");
      setDateTo(jobAlertFilter.date_to || "");
    }
  }, [jobAlertFilter]);

  // Update preferences mutation
  const updateMutation = useMutation({
    mutationFn: async (newPreferences: Partial<NotificationPreferences>) => {
      return await apiRequest("/api/notifications/settings", {
        method: "POST",
        body: JSON.stringify(newPreferences),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/settings"] });
      toast({
        title: "Settings saved",
        description: "Your notification preferences have been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update notification preferences.",
        variant: "destructive",
      });
    },
  });

  // Update job alert filters mutation
  const updateFiltersMutation = useMutation({
    mutationFn: async (filters: Partial<JobAlertFilter>) => {
      return await apiRequest("/api/notifications/job-alerts", {
        method: "POST",
        body: JSON.stringify(filters),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/job-alerts"] });
      toast({
        title: "Job alerts updated",
        description: "Your job alert preferences have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update job alert preferences.",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (key: keyof NotificationPreferences, value: boolean) => {
    if (!localPreferences) return;

    const newPreferences = { ...localPreferences, [key]: value };
    setLocalPreferences(newPreferences);
    updateMutation.mutate({ [key]: value });
  };

  // Job alert filter handlers
  const handleAddSkill = () => {
    if (skillInput.trim() && !filterSkills.includes(skillInput.trim())) {
      const newSkills = [...filterSkills, skillInput.trim()];
      setFilterSkills(newSkills);
      setSkillInput("");
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setFilterSkills(filterSkills.filter(s => s !== skill));
  };

  const handleAddLocation = () => {
    if (locationInput.trim() && !filterLocations.includes(locationInput.trim())) {
      const newLocations = [...filterLocations, locationInput.trim()];
      setFilterLocations(newLocations);
      setLocationInput("");
    }
  };

  const handleRemoveLocation = (location: string) => {
    setFilterLocations(filterLocations.filter(l => l !== location));
  };

  const handleAddKeyword = () => {
    if (keywordInput.trim() && !filterKeywords.includes(keywordInput.trim())) {
      const newKeywords = [...filterKeywords, keywordInput.trim()];
      setFilterKeywords(newKeywords);
      setKeywordInput("");
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setFilterKeywords(filterKeywords.filter(k => k !== keyword));
  };

  const handleSaveFilters = () => {
    updateFiltersMutation.mutate({
      skills: filterSkills.length > 0 ? filterSkills : null,
      locations: filterLocations.length > 0 ? filterLocations : null,
      keywords: filterKeywords.length > 0 ? filterKeywords : null,
      location_radius_km: locationRadiusKm,
      date_from: dateFrom || null,
      date_to: dateTo || null,
      is_active: true,
    });
  };

  if (isLoading || !localPreferences) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="h-12 bg-muted animate-pulse rounded" />
            <div className="h-12 bg-muted animate-pulse rounded" />
            <div className="h-12 bg-muted animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Email Notifications
          </CardTitle>
          <CardDescription>
            Choose which email notifications you&apos;d like to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-0 py-2">
          <div className="flex items-center justify-between py-2.5 px-1">
            <div className="flex items-center gap-2.5">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <Label
                htmlFor="email_messages"
                className="text-sm font-medium cursor-pointer"
                data-testid="label-email-messages"
              >
                New Messages
              </Label>
            </div>
            <Switch
              id="email_messages"
              checked={localPreferences.email_messages}
              onCheckedChange={checked => handleToggle("email_messages", checked)}
              data-testid="switch-email-messages"
            />
          </div>

          <Separator />

          {user.role === "freelancer" && (
            <>
              <div className="flex items-center justify-between py-2.5 px-1">
                <div className="flex items-center gap-2.5">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <Label
                    htmlFor="email_application_updates"
                    className="text-sm font-medium cursor-pointer"
                    data-testid="label-email-application-updates"
                  >
                    Application Updates
                  </Label>
                </div>
                <Switch
                  id="email_application_updates"
                  checked={localPreferences.email_application_updates}
                  onCheckedChange={checked => handleToggle("email_application_updates", checked)}
                  data-testid="switch-email-application-updates"
                />
              </div>
              <Separator />
            </>
          )}

          {user.role === "recruiter" && (
            <>
              <div className="flex items-center justify-between py-2.5 px-1">
                <div className="flex items-center gap-2.5">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <Label
                    htmlFor="email_job_updates"
                    className="text-sm font-medium cursor-pointer"
                    data-testid="label-email-job-updates"
                  >
                    Job Applications
                  </Label>
                </div>
                <Switch
                  id="email_job_updates"
                  checked={localPreferences.email_job_updates}
                  onCheckedChange={checked => handleToggle("email_job_updates", checked)}
                  data-testid="switch-email-job-updates"
                />
              </div>
              <Separator />
            </>
          )}

          {user.role === "freelancer" && (
            <>
              <div className="flex items-center justify-between py-2.5 px-1">
                <div className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <Label
                    htmlFor="email_job_alerts"
                    className="text-sm font-medium cursor-pointer"
                    data-testid="label-email-job-alerts"
                  >
                    Job Alerts
                  </Label>
                </div>
                <Switch
                  id="email_job_alerts"
                  checked={localPreferences.email_job_alerts}
                  onCheckedChange={checked => handleToggle("email_job_alerts", checked)}
                  data-testid="switch-email-job-alerts"
                />
              </div>
              <Separator />
            </>
          )}

          <div className="flex items-center justify-between py-2.5 px-1">
            <div className="flex items-center gap-2.5">
              <Star className="h-4 w-4 text-muted-foreground" />
              <Label
                htmlFor="email_rating_requests"
                className="text-sm font-medium cursor-pointer"
                data-testid="label-email-rating-requests"
              >
                Rating Requests
              </Label>
            </div>
            <Switch
              id="email_rating_requests"
              checked={localPreferences.email_rating_requests}
              onCheckedChange={checked => handleToggle("email_rating_requests", checked)}
              data-testid="switch-email-rating-requests"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between py-2.5 px-1">
            <div className="flex items-center gap-2.5">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <Label
                htmlFor="email_system_updates"
                className="text-sm font-medium cursor-pointer"
                data-testid="label-email-system-updates"
              >
                Platform Updates
              </Label>
            </div>
            <Switch
              id="email_system_updates"
              checked={localPreferences.email_system_updates}
              onCheckedChange={checked => handleToggle("email_system_updates", checked)}
              data-testid="switch-email-system-updates"
            />
          </div>
        </CardContent>
      </Card>

      {/* Job Alert Filters (Freelancers only) */}
      {user.role === "freelancer" && localPreferences.email_job_alerts && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Job Alert Filters
            </CardTitle>
            <CardDescription>Customize which jobs you get notified about</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Skills Filter */}
            <div className="space-y-3">
              <Label
                htmlFor="skill-input"
                className="text-base font-medium"
                data-testid="label-skills-filter"
              >
                Skills
              </Label>
              <p className="text-sm text-muted-foreground">
                Get notified about jobs that require specific skills
              </p>
              <div className="flex gap-2">
                <Input
                  id="skill-input"
                  placeholder="e.g., Sound Engineer, Lighting Tech"
                  value={skillInput}
                  onChange={e => setSkillInput(e.target.value)}
                  onKeyPress={e => e.key === "Enter" && (e.preventDefault(), handleAddSkill())}
                  data-testid="input-skill-filter"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleAddSkill}
                  data-testid="button-add-skill"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {filterSkills.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {filterSkills.map(skill => (
                    <Badge
                      key={skill}
                      variant="secondary"
                      className="gap-1"
                      data-testid={`badge-skill-${skill}`}
                    >
                      {skill}
                      <button
                        onClick={() => handleRemoveSkill(skill)}
                        className="ml-1 hover:text-destructive"
                        data-testid={`button-remove-skill-${skill}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Location Filter */}
            <div className="space-y-3">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <UKLocationInput
                    id="location-input"
                    label="Locations"
                    value={locationInput}
                    onChange={setLocationInput}
                    placeholder="Start typing a UK location..."
                    data-testid="input-location-filter"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Get notified about jobs in specific locations
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleAddLocation}
                  className="mb-1"
                  data-testid="button-add-location"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {filterLocations.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {filterLocations.map(location => (
                    <Badge
                      key={location}
                      variant="secondary"
                      className="gap-1"
                      data-testid={`badge-location-${location}`}
                    >
                      {location}
                      <button
                        onClick={() => handleRemoveLocation(location)}
                        className="ml-1 hover:text-destructive"
                        data-testid={`button-remove-location-${location}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm font-medium">Search Radius</Label>
                <div className="flex gap-2">
                  {[10, 30, 60, 100].map((radius) => (
                    <Button
                      key={radius}
                      type="button"
                      variant={locationRadiusKm === radius ? "default" : "outline"}
                      size="sm"
                      onClick={() => setLocationRadiusKm(radius)}
                      className="flex-1"
                    >
                      {radius} km
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Receive alerts for jobs within {locationRadiusKm} km of your selected locations
                </p>
              </div>
            </div>

            <Separator />

            {/* Keywords Filter */}
            <div className="space-y-3">
              <Label
                htmlFor="keyword-input"
                className="text-base font-medium"
                data-testid="label-keywords-filter"
              >
                Keywords
              </Label>
              <p className="text-sm text-muted-foreground">
                Get notified about jobs containing specific keywords in the title or description
              </p>
              <div className="flex gap-2">
                <Input
                  id="keyword-input"
                  placeholder="e.g., festival, corporate, live music"
                  value={keywordInput}
                  onChange={e => setKeywordInput(e.target.value)}
                  onKeyPress={e => e.key === "Enter" && (e.preventDefault(), handleAddKeyword())}
                  data-testid="input-keyword-filter"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleAddKeyword}
                  data-testid="button-add-keyword"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {filterKeywords.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {filterKeywords.map(keyword => (
                    <Badge
                      key={keyword}
                      variant="secondary"
                      className="gap-1"
                      data-testid={`badge-keyword-${keyword}`}
                    >
                      {keyword}
                      <button
                        onClick={() => handleRemoveKeyword(keyword)}
                        className="ml-1 hover:text-destructive"
                        data-testid={`button-remove-keyword-${keyword}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Date Range Filter */}
            <div className="space-y-3">
              <Label className="text-base font-medium" data-testid="label-date-range-filter">
                Date Range
              </Label>
              <p className="text-sm text-muted-foreground">
                Only get notified about jobs starting within a specific date range
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date-from" className="text-sm" data-testid="label-date-from">
                    From
                  </Label>
                  <Input
                    id="date-from"
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    data-testid="input-date-from"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date-to" className="text-sm" data-testid="label-date-to">
                    To
                  </Label>
                  <Input
                    id="date-to"
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    data-testid="input-date-to"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Save Button */}
            <div className="flex justify-end">
              <Button
                onClick={handleSaveFilters}
                disabled={updateFiltersMutation.isPending}
                data-testid="button-save-job-alerts"
              >
                {updateFiltersMutation.isPending ? "Saving..." : "Save Job Alert Preferences"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
