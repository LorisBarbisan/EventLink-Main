import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, AuthError, queryClient } from "@/lib/queryClient";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { Loader2, Sparkles, CheckCircle, XCircle, AlertCircle, RefreshCw, Briefcase, GraduationCap, Award } from "lucide-react";

interface ConfirmedFormFields {
  first_name?: string;
  last_name?: string;
  title?: string;
  skills?: string[];
  bio?: string;
  location?: string;
  experience_years?: string;
}

interface CVParsingReviewProps {
  onProfileUpdated?: () => void;
  onFieldsConfirmed?: (fields: ConfirmedFormFields) => void;
}

interface WorkHistoryEntry {
  jobTitle: string;
  company?: string;
  dates?: string;
  details?: string;
}

interface EducationEntry {
  qualification: string;
  institution?: string;
  dates?: string;
}

interface ExtractedData {
  fullName?: string;
  title?: string;
  skills?: string[];
  bio?: string;
  location?: string;
  experienceYears?: number;
  workHistory?: WorkHistoryEntry[];
  education?: EducationEntry[];
  certifications?: string[];
  confidenceData?: Record<string, { confidence: number; source: string }>;
}

interface ParsingStatus {
  status: "none" | "pending" | "parsing" | "completed" | "failed" | "confirmed" | "rejected";
  errorMessage?: string;
  extractedData?: ExtractedData;
  parsedAt?: string;
  confirmedAt?: string;
}

function ConfidenceBadge({ confidence }: { confidence?: number }) {
  if (confidence == null) return null;
  const pct = Math.round(confidence * 100);
  const color = pct >= 85 ? "text-green-600" : pct >= 70 ? "text-yellow-600" : "text-orange-500";
  return <span className={`text-xs font-medium ${color}`}>{pct}% match</span>;
}

export function CVParsingReview({ onProfileUpdated, onFieldsConfirmed }: CVParsingReviewProps) {
  const { toast } = useToast();
  const { subscribe } = useWebSocket();
  const [dismissed, setDismissed] = useState(false);
  const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>({
    fullName: true,
    title: true,
    skills: true,
    bio: true,
    location: true,
    experienceYears: true,
    workHistory: true,
    education: true,
    certifications: true,
  });

  const { data: parsingStatus, isLoading, refetch } = useQuery<ParsingStatus>({
    queryKey: ["/api/cv/parse/status"],
    refetchInterval: (query) => {
      const data = query.state.data as ParsingStatus | undefined;
      if (data?.status === "parsing" || data?.status === "pending") return 3000;
      return false;
    },
  });

  // Keep a stable ref to refetch so the WebSocket callback never goes stale
  const refetchRef = useRef(refetch);
  useEffect(() => { refetchRef.current = refetch; }, [refetch]);

  // Explicit polling: directly call apiRequest every 3s when parsing is active.
  // Bypasses TanStack Query's refetch machinery entirely (which can be silently
  // suppressed by deduplication or stale-check logic), then manually pushes the
  // result into the cache so all subscribers see the update immediately.
  useEffect(() => {
    if (parsingStatus?.status !== "parsing" && parsingStatus?.status !== "pending") return;
    const id = setInterval(async () => {
      try {
        const data = await apiRequest("/api/cv/parse/status");
        queryClient.setQueryData(["/api/cv/parse/status"], data);
      } catch (err) {
        if (err instanceof AuthError) clearInterval(id);
      }
    }, 3000);
    return () => clearInterval(id);
  }, [parsingStatus?.status]);

  useEffect(() => {
    if (
      parsingStatus?.status === "parsing" ||
      parsingStatus?.status === "pending" ||
      parsingStatus?.status === "completed"
    ) {
      setDismissed(false);
    }
  }, [parsingStatus?.status]);

  const handleWebSocketEvent = useCallback((data: any) => {
    if (data.type === "cv_parsing_update") {
      // Call refetch() directly — more reliable than invalidateQueries, always
      // forces a fresh fetch regardless of whether the query is considered "active".
      refetchRef.current();
    }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribe(handleWebSocketEvent);
    return unsubscribe;
  }, [subscribe, handleWebSocketEvent]);

  const confirmMutation = useMutation({
    mutationFn: async (fields: Record<string, boolean>) => {
      return apiRequest("/api/cv/parse/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedFields: fields }),
      });
    },
    onSuccess: (data) => {
      setDismissed(true);
      toast({
        title: "Profile updated",
        description: `${data.fieldsUpdated?.length || 0} fields updated from your CV.`,
      });

      if (onFieldsConfirmed && data.profile) {
        const p = data.profile;
        const formFields: ConfirmedFormFields = {};
        const updatedKeys = data.fieldsUpdated || [];
        if (updatedKeys.includes("first_name")) formFields.first_name = p.first_name || "";
        if (updatedKeys.includes("last_name")) formFields.last_name = p.last_name || "";
        if (updatedKeys.includes("title")) formFields.title = p.title || "";
        if (updatedKeys.includes("skills")) formFields.skills = p.skills || [];
        if (updatedKeys.includes("bio")) formFields.bio = p.bio || "";
        if (updatedKeys.includes("location")) formFields.location = p.location || "";
        if (updatedKeys.includes("experience_years")) {
          formFields.experience_years = p.experience_years != null ? String(p.experience_years) : "";
        }
        onFieldsConfirmed(formFields);
      }

      queryClient.invalidateQueries({ queryKey: ["/api/cv/parse/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/freelancer"] });
      onProfileUpdated?.();
    },
    onError: (error) => {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => apiRequest("/api/cv/parse/reject", { method: "POST" }),
    onSuccess: () => {
      setDismissed(true);
      toast({ title: "Suggestions dismissed", description: "You can always edit your profile manually." });
      queryClient.invalidateQueries({ queryKey: ["/api/cv/parse/status"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to dismiss",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  const reparseMutation = useMutation({
    mutationFn: async () => apiRequest("/api/cv/reparse", { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Re-analysing CV", description: "We're extracting information from your CV again." });
      queryClient.setQueryData(["/api/cv/parse/status"], { status: "parsing" });
      (async () => {
        let active = true;
        while (active) {
          await new Promise(r => setTimeout(r, 3000));
          try {
            const statusData = await apiRequest("/api/cv/parse/status");
            queryClient.setQueryData(["/api/cv/parse/status"], statusData);
            if (statusData.status !== "parsing" && statusData.status !== "pending") active = false;
          } catch (err) {
            if (err instanceof AuthError) return;
            active = false;
          }
        }
      })();
    },
    onError: (error) => {
      toast({
        title: "Failed to reparse",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  const toggleField = (field: string) => {
    setSelectedFields(prev => ({ ...prev, [field]: !prev[field] }));
  };

  if (isLoading) {
    return (
      <Card className="min-w-0 max-w-full overflow-hidden">
        <CardContent className="py-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (
    dismissed ||
    !parsingStatus ||
    parsingStatus.status === "none" ||
    parsingStatus.status === "confirmed" ||
    parsingStatus.status === "rejected"
  ) {
    return null;
  }

  if (parsingStatus.status === "parsing" || parsingStatus.status === "pending") {
    return (
      <Card className="min-w-0 max-w-full overflow-hidden border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Loader2 className="w-5 h-5 animate-spin text-orange-600" />
            Analysing your CV...
          </CardTitle>
          <CardDescription>
            We're running a multi-stage analysis to extract your skills, experience, and qualifications.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (parsingStatus.status === "failed") {
    return (
      <Card className="min-w-0 max-w-full overflow-hidden border-red-200 dark:border-red-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertCircle className="w-5 h-5 text-red-600" />
            CV Analysis Failed
          </CardTitle>
          <CardDescription>
            {parsingStatus.errorMessage || "We couldn't extract information from your CV. You can still fill in your profile manually."}
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => reparseMutation.mutate()}
            disabled={reparseMutation.isPending}
          >
            {reparseMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Try Again
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (parsingStatus.status === "completed" && parsingStatus.extractedData) {
    const data = parsingStatus.extractedData;
    const conf = data.confidenceData || {};

    const hasBasicInfo = data.fullName || data.title || data.bio || data.location || data.experienceYears;
    const hasSkills = data.skills?.length;
    const hasCertifications = data.certifications?.length;
    const hasWorkHistory = data.workHistory?.length;
    const hasEducation = data.education?.length;

    if (!hasBasicInfo && !hasSkills && !hasCertifications && !hasWorkHistory && !hasEducation) {
      return null;
    }

    const anySelected = Object.values(selectedFields).some(v => v);

    return (
      <Card className="min-w-0 max-w-full overflow-hidden border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-green-600" />
            CV Analysis Complete
          </CardTitle>
          <CardDescription>
            We found the following in your CV. Select what you'd like to apply to your profile.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">

          {/* ── Basic Info ── */}
          {hasBasicInfo && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Basic Info</h4>

              {data.fullName && (
                <FieldRow
                  id="fullName"
                  label="Name"
                  value={data.fullName}
                  checked={selectedFields.fullName}
                  onToggle={() => toggleField("fullName")}
                  confidence={conf.fullName?.confidence}
                />
              )}

              {data.title && (
                <FieldRow
                  id="title"
                  label="Professional Title"
                  value={data.title}
                  checked={selectedFields.title}
                  onToggle={() => toggleField("title")}
                  confidence={conf.title?.confidence}
                />
              )}

              {data.location && (
                <FieldRow
                  id="location"
                  label="Location"
                  value={data.location}
                  checked={selectedFields.location}
                  onToggle={() => toggleField("location")}
                  confidence={conf.location?.confidence}
                />
              )}

              {data.experienceYears && (
                <FieldRow
                  id="experienceYears"
                  label="Years of Experience"
                  value={`${data.experienceYears} years`}
                  checked={selectedFields.experienceYears}
                  onToggle={() => toggleField("experienceYears")}
                  confidence={conf.experienceYears?.confidence}
                />
              )}

              {data.bio && (
                <FieldRow
                  id="bio"
                  label="Bio / Summary"
                  value={data.bio}
                  checked={selectedFields.bio}
                  onToggle={() => toggleField("bio")}
                  clamp
                  confidence={conf.bio?.confidence}
                />
              )}
            </div>
          )}

          {/* ── Skills ── */}
          {hasSkills && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Skills</h4>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <Checkbox
                      id="field-skills"
                      className="mt-0.5 shrink-0"
                      checked={selectedFields.skills}
                      onCheckedChange={() => toggleField("skills")}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Label htmlFor="field-skills" className="cursor-pointer font-medium">
                          Technical Skills
                        </Label>
                        <ConfidenceBadge confidence={conf.skills?.confidence} />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {data.skills!.slice(0, 15).map((skill, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{skill}</Badge>
                        ))}
                        {data.skills!.length > 15 && (
                          <Badge variant="outline" className="text-xs">+{data.skills!.length - 15} more</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="w-fit shrink-0 text-xs sm:self-start">
                    Suggested from CV
                  </Badge>
                </div>
              </div>
            </>
          )}

          {/* ── Certifications ── */}
          {hasCertifications && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Award className="w-4 h-4" />
                  Certifications
                </h4>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <Checkbox
                      id="field-certifications"
                      className="mt-0.5 shrink-0"
                      checked={selectedFields.certifications}
                      onCheckedChange={() => toggleField("certifications")}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Label htmlFor="field-certifications" className="cursor-pointer font-medium">
                          Licences & Certifications
                        </Label>
                        <ConfidenceBadge confidence={conf.certifications?.confidence} />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {data.certifications!.map((cert, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{cert}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="w-fit shrink-0 text-xs sm:self-start">
                    Suggested from CV
                  </Badge>
                </div>
              </div>
            </>
          )}

          {/* ── Work History ── */}
          {hasWorkHistory && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4" />
                  Work History
                </h4>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <Checkbox
                      id="field-workHistory"
                      className="mt-0.5 shrink-0"
                      checked={selectedFields.workHistory}
                      onCheckedChange={() => toggleField("workHistory")}
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="field-workHistory" className="cursor-pointer font-medium">
                          Work Experience ({data.workHistory!.length} {data.workHistory!.length === 1 ? "role" : "roles"})
                        </Label>
                        <ConfidenceBadge confidence={conf.workHistory?.confidence} />
                      </div>
                      {data.workHistory!.slice(0, 4).map((entry, i) => (
                        <div key={i} className="rounded-md border bg-background/60 px-3 py-2 text-sm">
                          <p className="font-medium">{entry.jobTitle}</p>
                          {(entry.company || entry.dates) && (
                            <p className="text-muted-foreground text-xs">
                              {[entry.company, entry.dates].filter(Boolean).join(" · ")}
                            </p>
                          )}
                          {entry.details && (
                            <p className="text-muted-foreground text-xs mt-1 line-clamp-2">{entry.details}</p>
                          )}
                        </div>
                      ))}
                      {data.workHistory!.length > 4 && (
                        <p className="text-xs text-muted-foreground">
                          + {data.workHistory!.length - 4} more roles
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary" className="w-fit shrink-0 text-xs sm:self-start">
                    Suggested from CV
                  </Badge>
                </div>
              </div>
            </>
          )}

          {/* ── Education ── */}
          {hasEducation && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4" />
                  Education
                </h4>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <Checkbox
                      id="field-education"
                      className="mt-0.5 shrink-0"
                      checked={selectedFields.education}
                      onCheckedChange={() => toggleField("education")}
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="field-education" className="cursor-pointer font-medium">
                          Education History ({data.education!.length} {data.education!.length === 1 ? "entry" : "entries"})
                        </Label>
                        <ConfidenceBadge confidence={conf.education?.confidence} />
                      </div>
                      {data.education!.map((entry, i) => (
                        <div key={i} className="rounded-md border bg-background/60 px-3 py-2 text-sm">
                          <p className="font-medium">{entry.qualification}</p>
                          {(entry.institution || entry.dates) && (
                            <p className="text-muted-foreground text-xs">
                              {[entry.institution, entry.dates].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <Badge variant="secondary" className="w-fit shrink-0 text-xs sm:self-start">
                    Suggested from CV
                  </Badge>
                </div>
              </div>
            </>
          )}
        </CardContent>

        <Separator />
        <CardFooter className="flex flex-col gap-2 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => rejectMutation.mutate()}
            disabled={rejectMutation.isPending || confirmMutation.isPending}
          >
            {rejectMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <XCircle className="w-4 h-4 mr-2" />
            )}
            Dismiss
          </Button>
          <Button
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => confirmMutation.mutate(selectedFields)}
            disabled={confirmMutation.isPending || rejectMutation.isPending || !anySelected}
          >
            {confirmMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4 mr-2" />
            )}
            Apply Selected
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return null;
}

// ── Helper component ─────────────────────────────────────────────────────────

interface FieldRowProps {
  id: string;
  label: string;
  value: string;
  checked: boolean;
  onToggle: () => void;
  clamp?: boolean;
  confidence?: number;
}

function FieldRow({ id, label, value, checked, onToggle, clamp, confidence }: FieldRowProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Checkbox
          id={`field-${id}`}
          className="mt-0.5 shrink-0"
          checked={checked}
          onCheckedChange={onToggle}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Label htmlFor={`field-${id}`} className="cursor-pointer font-medium">
              {label}
            </Label>
            <ConfidenceBadge confidence={confidence} />
          </div>
          <p className={`text-sm text-muted-foreground break-words ${clamp ? "line-clamp-3" : ""}`}>
            {value}
          </p>
        </div>
      </div>
      <Badge variant="secondary" className="w-fit shrink-0 text-xs sm:self-start">
        Suggested from CV
      </Badge>
    </div>
  );
}
