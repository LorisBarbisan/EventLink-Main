import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { Loader2, Sparkles, X, AlertCircle, RefreshCw, Briefcase, GraduationCap, Award } from "lucide-react";

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

// Compute a stable sessionStorage key for a given parse result.
// Prefers parsedAt (set server-side after the service fix).
// Falls back to a content hash when parsedAt is absent (older records).
function getAppliedKey(extractedData?: ExtractedData, parsedAt?: string | null): string | null {
  if (parsedAt) return `cv-auto-applied-${parsedAt}`;
  if (!extractedData) return null;
  const fingerprint = [extractedData.title, extractedData.location, extractedData.fullName]
    .map((s) => (s ?? "").slice(0, 30))
    .join("|");
  if (!fingerprint.replace(/\|/g, "").trim()) return null;
  try {
    return `cv-auto-applied-hash-${btoa(encodeURIComponent(fingerprint)).slice(0, 24)}`;
  } catch {
    return null;
  }
}

export function CVParsingReview({ onProfileUpdated, onFieldsConfirmed }: CVParsingReviewProps) {
  const { toast } = useToast();
  const { subscribe } = useWebSocket();
  const [dismissed, setDismissed] = useState(false);

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
  useEffect(() => {
    if (parsingStatus?.status !== "parsing" && parsingStatus?.status !== "pending") return;
    const id = setInterval(async () => {
      try {
        const data = await apiRequest("/api/cv/parse/status");
        queryClient.setQueryData(["/api/cv/parse/status"], data);
      } catch {
        // ignore transient polling errors
      }
    }, 3000);
    return () => clearInterval(id);
  }, [parsingStatus?.status]);

  // Reset dismissed state when a new parse starts
  useEffect(() => {
    if (parsingStatus?.status === "parsing" || parsingStatus?.status === "pending") {
      setDismissed(false);
    }
  }, [parsingStatus?.status]);

  // Auto-apply all parsed fields to the form the moment parsing completes.
  // Uses sessionStorage keyed on parsedAt (or a content hash for older records)
  // so re-applying is skipped if this exact parse result was already applied —
  // even across component remounts triggered by parent state changes.
  useEffect(() => {
    if (
      parsingStatus?.status === "completed" &&
      parsingStatus.extractedData
    ) {
      const key = getAppliedKey(parsingStatus.extractedData, parsingStatus.parsedAt);
      if (!key || sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");

      setDismissed(false);

      if (onFieldsConfirmed) {
        const d = parsingStatus.extractedData;
        const formFields: ConfirmedFormFields = {};
        if (d.fullName) {
          const parts = d.fullName.trim().split(/\s+/);
          formFields.first_name = parts[0] || "";
          formFields.last_name = parts.slice(1).join(" ") || "";
        }
        if (d.title) formFields.title = d.title;
        if (d.skills?.length) formFields.skills = d.skills;
        if (d.bio) formFields.bio = d.bio;
        if (d.location) formFields.location = d.location;
        if (d.experienceYears) formFields.experience_years = String(d.experienceYears);
        onFieldsConfirmed(formFields);
      }

      toast({
        title: "Profile pre-filled from CV",
        description: "Review the fields below and click Save when ready.",
      });
    }
  }, [parsingStatus?.status, parsingStatus?.parsedAt]);

  const handleWebSocketEvent = useCallback((data: any) => {
    if (data.type === "cv_parsing_update") {
      refetchRef.current();
    }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribe(handleWebSocketEvent);
    return unsubscribe;
  }, [subscribe, handleWebSocketEvent]);

  // Dismissing the card silently marks it as rejected in DB so it won't reappear on reload
  const handleDismiss = () => {
    setDismissed(true);
    apiRequest("/api/cv/parse/reject", { method: "POST" }).catch(() => {});
  };

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
          } catch { active = false; }
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
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertCircle className="w-5 h-5 text-red-600" />
                CV Analysis Failed
              </CardTitle>
              <CardDescription className="mt-1">
                {parsingStatus.errorMessage || "We couldn't extract information from your CV. You can still fill in your profile manually."}
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" className="shrink-0" onClick={handleDismiss}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-fit"
            onClick={() => reparseMutation.mutate()}
            disabled={reparseMutation.isPending}
          >
            {reparseMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Try Again
          </Button>
        </CardHeader>
      </Card>
    );
  }

  if (
    (parsingStatus.status === "completed" || parsingStatus.status === "confirmed") &&
    parsingStatus.extractedData
  ) {
    const data = parsingStatus.extractedData;
    const conf = data.confidenceData || {};

    const hasBasicInfo = data.fullName || data.title || data.bio || data.location || data.experienceYears;
    const hasSkills = data.skills?.length;
    const hasCertifications = data.certifications?.length;
    const hasWorkHistory = data.workHistory?.length;
    const hasEducation = data.education?.length;

    if (!hasBasicInfo && !hasSkills && !hasCertifications && !hasWorkHistory && !hasEducation) {
      return (
        <Card className="min-w-0 max-w-full overflow-hidden border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  CV Analysed
                </CardTitle>
                <CardDescription className="mt-1">
                  Your CV was analysed but we couldn't extract specific fields. You can fill in your profile manually below.
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" className="shrink-0" onClick={handleDismiss}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
        </Card>
      );
    }

    return (
      <Card className="min-w-0 max-w-full overflow-hidden border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="w-5 h-5 text-green-600" />
                CV Analysis Complete
              </CardTitle>
              <CardDescription className="mt-1">
                Your profile has been pre-filled with the data below. Review and click Save when ready.
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" className="shrink-0" onClick={handleDismiss}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">

          {/* ── Basic Info ── */}
          {hasBasicInfo && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Basic Info</h4>

              {data.fullName && (
                <FieldRow label="Name" value={data.fullName} confidence={conf.fullName?.confidence} />
              )}
              {data.title && (
                <FieldRow label="Professional Title" value={data.title} confidence={conf.title?.confidence} />
              )}
              {data.location && (
                <FieldRow label="Location" value={data.location} confidence={conf.location?.confidence} />
              )}
              {data.experienceYears && (
                <FieldRow label="Years of Experience" value={`${data.experienceYears} years`} confidence={conf.experienceYears?.confidence} />
              )}
              {data.bio && (
                <FieldRow label="Bio / Summary" value={data.bio} clamp confidence={conf.bio?.confidence} />
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
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">Technical Skills</span>
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
                  <Badge variant="secondary" className="w-fit shrink-0 text-xs sm:self-start">Applied</Badge>
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
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">Licences & Certifications</span>
                      <ConfidenceBadge confidence={conf.certifications?.confidence} />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {data.certifications!.map((cert, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{cert}</Badge>
                      ))}
                    </div>
                  </div>
                  <Badge variant="secondary" className="w-fit shrink-0 text-xs sm:self-start">Applied</Badge>
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
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        Work Experience ({data.workHistory!.length} {data.workHistory!.length === 1 ? "role" : "roles"})
                      </span>
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
                      <p className="text-xs text-muted-foreground">+ {data.workHistory!.length - 4} more roles</p>
                    )}
                  </div>
                  <Badge variant="secondary" className="w-fit shrink-0 text-xs sm:self-start">Applied</Badge>
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
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        Education History ({data.education!.length} {data.education!.length === 1 ? "entry" : "entries"})
                      </span>
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
                  <Badge variant="secondary" className="w-fit shrink-0 text-xs sm:self-start">Applied</Badge>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return null;
}

// ── Helper component ─────────────────────────────────────────────────────────

interface FieldRowProps {
  label: string;
  value: string;
  clamp?: boolean;
  confidence?: number;
}

function FieldRow({ label, value, clamp, confidence }: FieldRowProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{label}</span>
          <ConfidenceBadge confidence={confidence} />
        </div>
        <p className={`text-sm text-muted-foreground break-words ${clamp ? "line-clamp-3" : ""}`}>
          {value}
        </p>
      </div>
      <Badge variant="secondary" className="w-fit shrink-0 text-xs sm:self-start">Applied</Badge>
    </div>
  );
}
