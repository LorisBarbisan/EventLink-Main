import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { Loader2, Sparkles, CheckCircle, XCircle, AlertCircle, RefreshCw } from "lucide-react";

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

interface ExtractedData {
  fullName?: string;
  title?: string;
  skills?: string[];
  bio?: string;
  location?: string;
  experienceYears?: number;
  education?: string;
  workHistory?: string;
  certifications?: string[];
}

interface ParsingStatus {
  status: "none" | "pending" | "parsing" | "completed" | "failed" | "confirmed" | "rejected";
  errorMessage?: string;
  extractedData?: ExtractedData;
  parsedAt?: string;
  confirmedAt?: string;
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
  });

  const { data: parsingStatus, isLoading, refetch } = useQuery<ParsingStatus>({
    queryKey: ["/api/cv/parse/status"],
    refetchInterval: (query) => {
      const data = query.state.data as ParsingStatus | undefined;
      if (data?.status === "parsing" || data?.status === "pending") {
        return 3000;
      }
      return false;
    },
  });

  useEffect(() => {
    if (parsingStatus?.status === "parsing" || parsingStatus?.status === "pending" || parsingStatus?.status === "completed") {
      setDismissed(false);
    }
  }, [parsingStatus?.status]);

  const handleWebSocketEvent = useCallback((data: any) => {
    if (data.type === "cv_parsing_update") {
      console.log("📡 WebSocket: CV parsing update received:", data.status);
      if (data.status === "completed" && data.extractedData) {
        queryClient.setQueryData(["/api/cv/parse/status"], {
          status: "completed",
          extractedData: data.extractedData,
        });
      } else if (data.status === "failed") {
        queryClient.setQueryData(["/api/cv/parse/status"], {
          status: "failed",
          errorMessage: "CV analysis failed. You can try again.",
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/cv/parse/status"] });
      }
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
    mutationFn: async () => {
      return apiRequest("/api/cv/parse/reject", {
        method: "POST",
      });
    },
    onSuccess: () => {
      setDismissed(true);
      toast({
        title: "Suggestions dismissed",
        description: "You can always edit your profile manually.",
      });
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
    mutationFn: async () => {
      return apiRequest("/api/cv/reparse", {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({
        title: "Re-analysing CV",
        description: "We're extracting information from your CV again.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cv/parse/status"] });
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
      <Card>
        <CardContent className="py-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (dismissed || !parsingStatus || parsingStatus.status === "none" || parsingStatus.status === "confirmed" || parsingStatus.status === "rejected") {
    return null;
  }

  if (parsingStatus.status === "parsing" || parsingStatus.status === "pending") {
    return (
      <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Loader2 className="w-5 h-5 animate-spin text-orange-600" />
            Analysing your CV...
          </CardTitle>
          <CardDescription>
            We're extracting information from your CV to help populate your profile.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (parsingStatus.status === "failed") {
    return (
      <Card className="border-red-200 dark:border-red-800">
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
            {reparseMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Try Again
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (parsingStatus.status === "completed" && parsingStatus.extractedData) {
    const data = parsingStatus.extractedData;
    const hasAnyData = data.fullName || data.title || data.skills?.length || data.bio || data.location || data.experienceYears;

    if (!hasAnyData) {
      return null;
    }

    return (
      <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-green-600" />
            CV Analysis Complete
          </CardTitle>
          <CardDescription>
            We found some information in your CV. Select what you'd like to add to your profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.fullName && (
            <div className="flex items-start gap-3">
              <Checkbox
                id="field-fullName"
                checked={selectedFields.fullName}
                onCheckedChange={() => toggleField("fullName")}
              />
              <div className="flex-1">
                <Label htmlFor="field-fullName" className="font-medium cursor-pointer">
                  Name
                </Label>
                <p className="text-sm text-muted-foreground">{data.fullName}</p>
              </div>
              <Badge variant="secondary" className="text-xs">Suggested from CV</Badge>
            </div>
          )}

          {data.title && (
            <div className="flex items-start gap-3">
              <Checkbox
                id="field-title"
                checked={selectedFields.title}
                onCheckedChange={() => toggleField("title")}
              />
              <div className="flex-1">
                <Label htmlFor="field-title" className="font-medium cursor-pointer">
                  Professional Title
                </Label>
                <p className="text-sm text-muted-foreground">{data.title}</p>
              </div>
              <Badge variant="secondary" className="text-xs">Suggested from CV</Badge>
            </div>
          )}

          {data.skills && data.skills.length > 0 && (
            <div className="flex items-start gap-3">
              <Checkbox
                id="field-skills"
                checked={selectedFields.skills}
                onCheckedChange={() => toggleField("skills")}
              />
              <div className="flex-1">
                <Label htmlFor="field-skills" className="font-medium cursor-pointer">
                  Skills
                </Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {data.skills.slice(0, 10).map((skill, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{skill}</Badge>
                  ))}
                  {data.skills.length > 10 && (
                    <Badge variant="outline" className="text-xs">+{data.skills.length - 10} more</Badge>
                  )}
                </div>
              </div>
              <Badge variant="secondary" className="text-xs">Suggested from CV</Badge>
            </div>
          )}

          {data.bio && (
            <div className="flex items-start gap-3">
              <Checkbox
                id="field-bio"
                checked={selectedFields.bio}
                onCheckedChange={() => toggleField("bio")}
              />
              <div className="flex-1">
                <Label htmlFor="field-bio" className="font-medium cursor-pointer">
                  Bio / Summary
                </Label>
                <p className="text-sm text-muted-foreground line-clamp-3">{data.bio}</p>
              </div>
              <Badge variant="secondary" className="text-xs">Suggested from CV</Badge>
            </div>
          )}

          {data.location && (
            <div className="flex items-start gap-3">
              <Checkbox
                id="field-location"
                checked={selectedFields.location}
                onCheckedChange={() => toggleField("location")}
              />
              <div className="flex-1">
                <Label htmlFor="field-location" className="font-medium cursor-pointer">
                  Location
                </Label>
                <p className="text-sm text-muted-foreground">{data.location}</p>
              </div>
              <Badge variant="secondary" className="text-xs">Suggested from CV</Badge>
            </div>
          )}

          {data.experienceYears && (
            <div className="flex items-start gap-3">
              <Checkbox
                id="field-experienceYears"
                checked={selectedFields.experienceYears}
                onCheckedChange={() => toggleField("experienceYears")}
              />
              <div className="flex-1">
                <Label htmlFor="field-experienceYears" className="font-medium cursor-pointer">
                  Years of Experience
                </Label>
                <p className="text-sm text-muted-foreground">{data.experienceYears} years</p>
              </div>
              <Badge variant="secondary" className="text-xs">Suggested from CV</Badge>
            </div>
          )}
        </CardContent>
        <Separator />
        <CardFooter className="flex justify-between pt-4">
          <Button
            variant="ghost"
            size="sm"
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
            onClick={() => confirmMutation.mutate(selectedFields)}
            disabled={confirmMutation.isPending || rejectMutation.isPending || !Object.values(selectedFields).some(v => v)}
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
