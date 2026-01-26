import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Download, FileText, Plus, Trash2, Upload, Shield } from "lucide-react";
import { useState } from "react";

interface Document {
  id: number;
  freelancer_id: number;
  document_type: string;
  file_url: string;
  original_filename: string;
  file_size: number;
  file_type: string;
  uploaded_at: string;
}

interface DocumentUploaderProps {
  userId: number;
  isOwner: boolean;
  viewerRole?: "freelancer" | "recruiter" | "admin";
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  PLI: "Public Liability Insurance",
  BS7909: "BS7909 Certificate",
  IPAF: "IPAF Certificate",
  NRC: "NRC Certificate",
  PASMA: "PASMA Certificate",
  "First Aid": "First Aid Certificate",
  "Electrical Safety": "Electrical Safety Certificate",
  "Working at Height": "Working at Height Certificate",
  "Risk Assessment": "Risk Assessment",
  "Method Statement": "Method Statement",
  Other: "Other Document",
};

const MAX_DOCUMENTS = 9;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function DocumentUploader({ userId, isOwner, viewerRole }: DocumentUploaderProps) {
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);

  const canViewDocuments = isOwner || viewerRole === "recruiter" || viewerRole === "admin";

  const { data: documents = [], isLoading, isError } = useQuery<Document[]>({
    queryKey: ["/api/documents", userId],
    enabled: canViewDocuments,
  });

  const { data: documentTypes = [] } = useQuery<string[]>({
    queryKey: ["/api/documents/types"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (documentId: number) => {
      return apiRequest(`/api/documents/${documentId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", userId] });
      toast({
        title: "Document deleted",
        description: "The document has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "Failed to delete document. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedType) {
      toast({
        title: "Select document type",
        description: "Please select a document type before uploading.",
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }

    const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF, JPG, or PNG file.",
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File too large",
        description: "File size must be less than 10MB.",
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }

    if (documents.length >= MAX_DOCUMENTS) {
      toast({
        title: "Maximum documents reached",
        description: `You can upload a maximum of ${MAX_DOCUMENTS} documents. Delete an existing document to upload a new one.`,
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }

    setIsUploading(true);
    try {
      const fileData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(",")[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      await apiRequest("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileData,
          filename: file.name,
          fileSize: file.size,
          contentType: file.type,
          documentType: selectedType,
        }),
      });

      queryClient.invalidateQueries({ queryKey: ["/api/documents", userId] });
      setSelectedType("");

      toast({
        title: "Document uploaded",
        description: "Your document has been uploaded successfully.",
      });
    } catch (error) {
      let errorMessage = "Failed to upload document. Please try again.";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const handleDownload = async (document: Document) => {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`/api/documents/${document.id}/download`, {
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
          description: "Failed to download document. Please try again.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Download failed",
        description: "Failed to download document. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  if (!canViewDocuments) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Documents & Certifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-12 bg-muted rounded"></div>
            <div className="h-12 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isOwner && documents.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Documents & Certifications
        </CardTitle>
        <CardDescription>
          {isOwner
            ? `Upload your certifications and compliance documents (${documents.length}/${MAX_DOCUMENTS})`
            : "View certifications and compliance documents"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isOwner && documents.length < MAX_DOCUMENTS && (
          <div className="border-2 border-dashed rounded-lg p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {DOCUMENT_TYPE_LABELS[type] || type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <label htmlFor="document-upload">
                <Button
                  variant="outline"
                  disabled={isUploading || !selectedType}
                  asChild
                >
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    {isUploading ? "Uploading..." : "Upload"}
                  </span>
                </Button>
              </label>
              <input
                id="document-upload"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isUploading || !selectedType}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Accepted: PDF, JPG, PNG (max 10MB)
            </p>
          </div>
        )}

        {documents.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium mb-2">No documents uploaded</h3>
            <p className="text-sm text-muted-foreground">
              {isOwner
                ? "Upload your certifications to showcase your credentials"
                : "This freelancer hasn't uploaded any documents yet"}
            </p>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="p-2 bg-primary/10 rounded shrink-0">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Badge variant="secondary" className="mb-1">
                      {doc.document_type}
                    </Badge>
                    <p className="text-xs text-muted-foreground truncate">
                      {doc.original_filename}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(doc.file_size)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0 ml-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDownload(doc)}
                    title="View/Download"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(doc.id)}
                      disabled={deleteMutation.isPending}
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {isOwner && documents.length >= MAX_DOCUMENTS && (
          <p className="text-sm text-muted-foreground text-center">
            Maximum documents reached. Delete an existing document to upload a new one.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface DocumentBadgesProps {
  freelancerId: number;
  viewerRole?: "freelancer" | "recruiter" | "admin";
  isOwner?: boolean;
}

export function DocumentBadges({ freelancerId, viewerRole, isOwner }: DocumentBadgesProps) {
  const canViewDocuments = isOwner || viewerRole === "recruiter" || viewerRole === "admin";

  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents", freelancerId],
    enabled: canViewDocuments,
  });

  const handleDownload = async (document: Document) => {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`/api/documents/${document.id}/download`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.downloadUrl) {
          window.open(data.downloadUrl, "_blank");
        }
      }
    } catch {
      console.error("Failed to download document");
    }
  };

  if (!canViewDocuments || isLoading || documents.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {documents.map((doc) => (
        <Button
          key={doc.id}
          variant="outline"
          size="sm"
          onClick={() => handleDownload(doc)}
          className="gap-2"
        >
          <Shield className="w-3 h-3" />
          {doc.document_type}
        </Button>
      ))}
    </div>
  );
}
