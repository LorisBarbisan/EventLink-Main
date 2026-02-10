import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Eye, FileText, Shield, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useLocation } from "wouter";

interface Document {
  id: number;
  freelancer_id: number;
  document_type: string;
  custom_type_name?: string | null;
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

// Shorter labels for button display (without "Certificate", PLI abbreviated)
const DOCUMENT_BUTTON_LABELS: Record<string, string> = {
  PLI: "PLI",
  BS7909: "BS7909",
  IPAF: "IPAF",
  NRC: "NRC",
  PASMA: "PASMA",
  "First Aid": "First Aid",
  "Electrical Safety": "Electrical Safety",
  "Working at Height": "Working at Height",
  "Risk Assessment": "Risk Assessment",
  "Method Statement": "Method Statement",
  Other: "Other",
};

const MAX_DOCUMENTS = 9;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function DocumentUploader({ userId, isOwner, viewerRole }: DocumentUploaderProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedType, setSelectedType] = useState<string>("");
  const [customTypeName, setCustomTypeName] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);
  const privacyConfirmedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSignedIn = !!viewerRole;

  const {
    data: documents = [],
    isLoading,
    isError,
  } = useQuery<Document[]>({
    queryKey: [`/api/documents/${userId}`],
    enabled: userId > 0,
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
      queryClient.invalidateQueries({ queryKey: [`/api/documents/${userId}`] });
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

    if (!privacyConfirmedRef.current) {
      event.target.value = "";
      return;
    }
    privacyConfirmedRef.current = false;

    if (!selectedType) {
      toast({
        title: "Select document type",
        description: "Please select a document type before uploading.",
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }

    if (selectedType === "Other" && !customTypeName.trim()) {
      toast({
        title: "Enter document type name",
        description: "Please enter a name for your custom document type.",
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
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = (reader.result as string).split(",")[1];

          await apiRequest("/api/documents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileData: base64Data,
              filename: file.name,
              fileSize: file.size,
              contentType: file.type,
              documentType: selectedType,
              customTypeName: selectedType === "Other" ? customTypeName.trim() : null,
            }),
          });

          queryClient.invalidateQueries({ queryKey: [`/api/documents/${userId}`] });
          setSelectedType("");
          setCustomTypeName("");

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
      reader.onerror = () => {
        toast({
          title: "Upload failed",
          description: "Failed to read file. Please try again.",
          variant: "destructive",
        });
        setIsUploading(false);
        event.target.value = "";
      };
      reader.readAsDataURL(file);
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

  const redirectToAuth = () => {
    const currentPath = window.location.pathname;
    setLocation(`/auth?redirect=${encodeURIComponent(currentPath)}`);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Documents & Certifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-12 rounded bg-muted"></div>
            <div className="h-12 rounded bg-muted"></div>
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
          <Shield className="h-5 w-5" />
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
          <div className="space-y-3 rounded-lg border-2 border-dashed p-4">
            <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Important</p>
                <p className="mt-1">
                  Documents uploaded here can be viewed by signed-in employers on EventLink.
                  Please ensure you remove or conceal personal information such as your home address or other sensitive details before uploading.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Select
                value={selectedType}
                onValueChange={(value) => {
                  setSelectedType(value);
                  if (value !== "Other") {
                    setCustomTypeName("");
                  }
                }}
              >
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

              <Button
                variant="outline"
                disabled={
                  isUploading ||
                  !selectedType ||
                  (selectedType === "Other" && !customTypeName.trim())
                }
                onClick={() => setShowPrivacyDialog(true)}
              >
                <Upload className="mr-2 h-4 w-4" />
                {isUploading ? "Uploading..." : "Upload"}
              </Button>
              <input
                ref={fileInputRef}
                id="document-upload"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isUploading}
              />
            </div>

            {selectedType === "Other" && (
              <Input
                placeholder="Enter custom document type name"
                value={customTypeName}
                onChange={(e) => setCustomTypeName(e.target.value)}
                maxLength={50}
                className="w-full"
              />
            )}

            <p className="text-center text-xs text-muted-foreground">
              Accepted: PDF, JPG, PNG (max 10MB)
            </p>
          </div>
        )}

        {documents.length === 0 ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-2 font-medium">No documents uploaded</h3>
            <p className="text-sm text-muted-foreground">
              {isOwner
                ? "Upload your certifications to showcase your credentials"
                : "This freelancer hasn't uploaded any documents yet"}
            </p>
          </div>
        ) : isOwner ? (
          /* Owner view - shows file details and delete option */
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="shrink-0 rounded bg-primary/10 p-2">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Badge variant="secondary" className="mb-1">
                      {doc.document_type === "Other" && doc.custom_type_name
                        ? doc.custom_type_name
                        : DOCUMENT_TYPE_LABELS[doc.document_type] || doc.document_type}
                    </Badge>
                    <p className="truncate text-xs text-muted-foreground">
                      {doc.original_filename}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(doc.file_size)}</p>
                  </div>
                </div>
                <div className="ml-2 flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(doc)}
                    title="View"
                    className="gap-1"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(doc.id)}
                    disabled={deleteMutation.isPending}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Viewer view - simple orange buttons with just the type name */
          <div className="flex flex-wrap gap-2">
            {documents.map((doc) => (
              <Button
                key={doc.id}
                onClick={() => isSignedIn ? handleDownload(doc) : redirectToAuth()}
                className="bg-gradient-primary hover:bg-primary-hover w-[140px] h-10 text-sm"
              >
                {doc.document_type === "Other" && doc.custom_type_name
                  ? doc.custom_type_name
                  : DOCUMENT_BUTTON_LABELS[doc.document_type] || doc.document_type}
              </Button>
            ))}
          </div>
        )}

        {isOwner && documents.length >= MAX_DOCUMENTS && (
          <p className="text-center text-sm text-muted-foreground">
            Maximum documents reached. Delete an existing document to upload a new one.
          </p>
        )}
      </CardContent>

      <AlertDialog open={showPrivacyDialog} onOpenChange={setShowPrivacyDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Before you upload</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Certificates uploaded to EventLink can be viewed by signed-in employers.
                </p>
                <p>
                  Please make sure you have removed or concealed personal information, including:
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Home address</li>
                  <li>Date of birth</li>
                  <li>National Insurance number</li>
                  <li>Any other sensitive personal data</li>
                </ul>
                <p>
                  EventLink can not conceal this information and recommends you hide it before uploading.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                privacyConfirmedRef.current = true;
                fileInputRef.current?.click();
              }}
            >
              I understand and wish to continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

interface DocumentBadgesProps {
  freelancerId: number;
  viewerRole?: "freelancer" | "recruiter" | "admin";
  isOwner?: boolean;
}

export function DocumentBadges({ freelancerId, viewerRole, isOwner }: DocumentBadgesProps) {
  const [, setLocation] = useLocation();
  const isSignedIn = !!viewerRole || !!isOwner;

  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: [`/api/documents/${freelancerId}`],
    enabled: freelancerId > 0,
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

  if (isLoading || documents.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {documents.map((doc) => (
        <Button
          key={doc.id}
          onClick={() => {
            if (!isSignedIn) {
              const currentPath = window.location.pathname;
              setLocation(`/auth?redirect=${encodeURIComponent(currentPath)}`);
              return;
            }
            handleDownload(doc);
          }}
          className="bg-gradient-primary hover:bg-primary-hover w-[140px] h-10 text-sm"
        >
          {doc.document_type === "Other" && doc.custom_type_name
            ? doc.custom_type_name
            : DOCUMENT_BUTTON_LABELS[doc.document_type] || doc.document_type}
        </Button>
      ))}
    </div>
  );
}
