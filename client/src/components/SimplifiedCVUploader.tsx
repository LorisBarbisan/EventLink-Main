import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, AuthError, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Upload, Download, Trash2, CheckCircle, Sparkles } from "lucide-react";

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
      // Optimistically show spinner, then kick off the same self-contained polling loop
      queryClient.setQueryData(["/api/cv/parse/status"], { status: "parsing" });
      (async () => {
        let active = true;
        while (active) {
          await new Promise((r) => setTimeout(r, 3000));
          try {
            const statusData = await apiRequest("/api/cv/parse/status");
            queryClient.setQueryData(["/api/cv/parse/status"], statusData);
            if (statusData.status !== "parsing" && statusData.status !== "pending") {
              active = false;
            }
          } catch (err) {
            if (err instanceof AuthError) return;
            active = false;
          }
        }
      })();
    },
    onError: (error) => {
      toast({
        title: "Extraction failed",
        description: error instanceof Error ? error.message : "Failed to extract CV data",
        variant: "destructive",
      });
    },
  });

  const showExtractButton =
    currentCV?.fileName &&
    (!parsingStatus || (parsingStatus.status !== "parsing" && parsingStatus.status !== "pending"));

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

      // Optimistically show spinner immediately
      queryClient.setQueryData(["/api/cv/parse/status"], { status: "parsing" });

      // Kick off a self-contained polling loop that updates the shared cache every 3s
      // until the parse finishes. This is independent of TanStack Query's refetch
      // machinery so it always fires regardless of observer/stale state.
      (async () => {
        let active = true;
        while (active) {
          await new Promise((r) => setTimeout(r, 3000));
          try {
            const statusData = await apiRequest("/api/cv/parse/status");
            queryClient.setQueryData(["/api/cv/parse/status"], statusData);
            if (statusData.status !== "parsing" && statusData.status !== "pending") {
              active = false;
            }
          } catch (err) {
            if (err instanceof AuthError) return;
            active = false;
          }
        }
      })();

      // Wait for the callback to complete with the response profile
      if (onUploadComplete) {
        await onUploadComplete(response.profile);
      }
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
    } catch {
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

  if (currentCV?.fileName) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <CheckCircle className="h-4 w-4 shrink-0 text-green-600" />
        <span className="max-w-[160px] truncate text-sm font-medium" title={currentCV.fileName}>
          {currentCV.fileName}
        </span>
        {currentCV.fileSize && (
          <span className="text-xs text-muted-foreground">
            ({formatFileSize(currentCV.fileSize)})
          </span>
        )}
        {currentCV.fileUrl && (
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const token = localStorage.getItem("auth_token");
                const response = await fetch(`/api/cv/download/${userId}`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (response.ok) {
                  const blob = await response.blob();
                  window.open(URL.createObjectURL(blob), "_blank");
                } else {
                  toast({
                    title: "Download failed",
                    description: "Failed to download CV.",
                    variant: "destructive",
                  });
                }
              } catch {
                toast({
                  title: "Download failed",
                  description: "Failed to download CV.",
                  variant: "destructive",
                });
              }
            }}
            data-testid="button-download-cv"
          >
            <Download className="mr-1 h-3 w-3" /> View
          </Button>
        )}
        {showExtractButton && (
          <Button
            size="sm"
            onClick={() => extractMutation.mutate()}
            disabled={extractMutation.isPending}
          >
            <Sparkles className="mr-1 h-3 w-3" />
            {extractMutation.isPending ? "Extracting…" : "Extract data"}
          </Button>
        )}
        <label htmlFor="cv-file-replace">
          <Button variant="outline" size="sm" disabled={isUploading} asChild>
            <span>
              <Upload className="mr-1 h-3 w-3" />
              {isUploading ? "Uploading…" : "Replace"}
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
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={isDeleting}
          data-testid="button-delete-cv"
        >
          <Trash2 className="mr-1 h-3 w-3" />
          {isDeleting ? "Deleting…" : "Delete"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="cv-file-upload">
        <Button size="sm" disabled={isUploading} asChild>
          <span>
            <Upload className="mr-1 h-3 w-3" />
            {isUploading ? "Uploading…" : "Upload CV"}
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
      <span className="text-xs text-muted-foreground">PDF · max 5 MB</span>
    </div>
  );
}
