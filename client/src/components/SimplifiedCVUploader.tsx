import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Upload, FileText, Download, Trash2, CheckCircle, Sparkles } from "lucide-react";

interface CVUploaderProps {
  userId: number;
  currentCV?: {
    fileName?: string;
    fileSize?: number;
    fileUrl?: string;
  };
  onUploadComplete?: (updatedProfile?: any) => void;
}

export function SimplifiedCVUploader({ userId, currentCV, onUploadComplete }: CVUploaderProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAbortedRef = useRef(false);

  useEffect(() => {
    return () => {
      pollAbortedRef.current = true;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  const { data: parsingStatus } = useQuery<{ status: string }>({
    queryKey: ["/api/cv/parse/status"],
  });

  const extractMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/cv/reparse", { method: "POST" });
    },
    onSuccess: () => {
      toast({
        title: "Extracting CV data",
        description: "We're analysing your CV to extract your profile information.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cv/parse/status"] });

      pollAbortedRef.current = false;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      const pollForCompletion = async (attempt = 0) => {
        if (pollAbortedRef.current || attempt > 30) return;
        try {
          const token = localStorage.getItem("auth_token");
          const statusRes = await fetch("/api/cv/parse/status", {
            headers: {
              "Content-Type": "application/json",
              ...(token && { Authorization: `Bearer ${token}` }),
            },
          });
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (pollAbortedRef.current) return;
            if (statusData.status === "completed" || statusData.status === "failed") {
              const current = queryClient.getQueryData(["/api/cv/parse/status"]) as any;
              if (current?.status !== "confirmed" && current?.status !== "rejected") {
                queryClient.setQueryData(["/api/cv/parse/status"], statusData);
              }
              return;
            }
          }
        } catch (e) {
          // Silently continue polling
        }
        pollTimerRef.current = setTimeout(() => pollForCompletion(attempt + 1), 2000);
      };
      pollTimerRef.current = setTimeout(() => pollForCompletion(0), 3000);
    },
    onError: (error) => {
      toast({
        title: "Extraction failed",
        description: error instanceof Error ? error.message : "Failed to extract CV data",
        variant: "destructive",
      });
    },
  });

  const showExtractButton = currentCV?.fileName && 
    (!parsingStatus || parsingStatus.status !== "parsing" && parsingStatus.status !== "pending");

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (file.type !== "application/pdf") {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "File size must be less than 5MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      console.log("📤 Starting CV upload:", file.name, file.type, file.size);

      // Convert file to base64
      console.log("Step 1: Converting file to base64...");
      const fileData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(",")[1]; // Remove data:application/pdf;base64, prefix
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      console.log("✅ Step 1: File converted to base64");

      // Upload file to backend (backend handles upload to storage)
      console.log("Step 2: Uploading to server...");
      const response = await apiRequest("/api/cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileData,
          filename: file.name,
          fileSize: file.size,
          contentType: file.type,
        }),
      });
      console.log("✅ Step 2: File uploaded, response:", response);

      toast({
        title: "CV uploaded successfully",
        description: "Your CV has been uploaded and is being analysed.",
      });

      // Set parsing status to "parsing" in the cache so CVParsingReview shows loading state immediately
      queryClient.setQueryData(["/api/cv/parse/status"], { status: "parsing" });

      // Wait for the callback to complete with the response profile
      if (onUploadComplete) {
        await onUploadComplete(response.profile);
      }

      // Start a backup polling loop that explicitly fetches status until parsing completes
      pollAbortedRef.current = false;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      const pollForCompletion = async (attempt = 0) => {
        if (pollAbortedRef.current || attempt > 30) return;
        try {
          const token = localStorage.getItem("auth_token");
          const statusRes = await fetch("/api/cv/parse/status", {
            headers: {
              "Content-Type": "application/json",
              ...(token && { Authorization: `Bearer ${token}` }),
            },
          });
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (pollAbortedRef.current) return;
            if (statusData.status === "completed" || statusData.status === "failed") {
              const current = queryClient.getQueryData(["/api/cv/parse/status"]) as any;
              if (current?.status !== "confirmed" && current?.status !== "rejected") {
                queryClient.setQueryData(["/api/cv/parse/status"], statusData);
              }
              return;
            }
          }
        } catch (e) {
          // Silently continue polling
        }
        pollTimerRef.current = setTimeout(() => pollForCompletion(attempt + 1), 2000);
      };
      pollTimerRef.current = setTimeout(() => pollForCompletion(0), 3000);
    } catch (error) {
      console.error("❌ CV upload error:", error);
      console.error("Error type:", typeof error);
      console.error("Error details:", JSON.stringify(error, null, 2));

      // Extract detailed error message
      let errorMessage = "Failed to upload CV. Please try again.";
      if (error instanceof Error) {
        errorMessage = error.message;
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      } else if (typeof error === "object" && error !== null && "error" in error) {
        errorMessage = String((error as any).error);
      }

      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      event.target.value = "";
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await apiRequest("/api/cv", {
        method: "DELETE",
      });

      toast({
        title: "CV deleted",
        description: "Your CV has been removed.",
      });

      // Clear the CV parsing status
      queryClient.invalidateQueries({ queryKey: ["/api/cv/parse/status"] });

      // Wait for the callback to complete with the response profile
      if (onUploadComplete) {
        await onUploadComplete(response.profile);
      }
    } catch (error) {
      toast({
        title: "Delete failed",
        description: "Failed to delete CV. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          CV/Resume
        </CardTitle>
        <CardDescription>
          Upload your CV to showcase your experience to potential employers
        </CardDescription>
      </CardHeader>
      <CardContent>
        {currentCV?.fileName ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-medium">{currentCV.fileName}</p>
                  {currentCV.fileSize && (
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(currentCV.fileSize)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {currentCV.fileUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const token = localStorage.getItem("auth_token");
                        const response = await fetch(`/api/cv/download/${userId}`, {
                          headers: {
                            Authorization: `Bearer ${token}`,
                          },
                        });
                        if (response.ok) {
                          const data = await response.json();
                          if (data.downloadUrl) {
                            window.open(data.downloadUrl, "_blank");
                          }
                        } else {
                          toast({
                            title: "Download failed",
                            description: "Failed to download CV. Please try again.",
                            variant: "destructive",
                          });
                        }
                      } catch (error) {
                        toast({
                          title: "Download failed",
                          description: "Failed to download CV. Please try again.",
                          variant: "destructive",
                        });
                      }
                    }}
                    data-testid="button-download-cv"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    View
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  data-testid="button-delete-cv"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  {isDeleting ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </div>

            {showExtractButton && (
              <Button
                variant="default"
                className="w-full"
                onClick={() => extractMutation.mutate()}
                disabled={extractMutation.isPending}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {extractMutation.isPending ? "Extracting..." : "Extract profile data from CV"}
              </Button>
            )}

            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Want to upload a new CV?</p>
              <label htmlFor="cv-file-replace">
                <Button variant="outline" disabled={isUploading} asChild>
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    {isUploading ? "Uploading..." : "Replace CV"}
                  </span>
                </Button>
              </label>
              <input
                id="cv-file-replace"
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isUploading}
                data-testid="input-cv-file-replace"
              />
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="mb-4">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium mb-2">No CV uploaded</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Upload your CV to increase your chances of getting hired
              </p>
            </div>

            <label htmlFor="cv-file-upload">
              <Button disabled={isUploading} asChild>
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  {isUploading ? "Uploading..." : "Upload CV"}
                </span>
              </Button>
            </label>
            <input
              id="cv-file-upload"
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isUploading}
              data-testid="input-cv-file-upload"
            />

            <div className="mt-4 text-xs text-muted-foreground">
              <p>Accepted format: PDF</p>
              <p>Maximum size: 5MB</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
