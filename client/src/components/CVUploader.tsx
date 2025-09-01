import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileText, Upload, X, CheckCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface CVUploaderProps {
  userId: number;
  currentCV?: {
    fileName?: string;
    fileType?: string;
    fileSize?: number;
    fileUrl?: string;
  };
  onUploadComplete?: () => void;
  "data-testid"?: string;
}

export function CVUploader({ userId, currentCV, onUploadComplete, "data-testid": dataTestId }: CVUploaderProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Format file size helper
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF, DOC, or DOCX file.",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 5MB.",
        variant: "destructive"
      });
      return;
    }

    await uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);

    try {
      // Step 1: Get upload URL from backend
      const uploadUrlResponse = await fetch('/api/cv/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!uploadUrlResponse.ok) {
        const errorData = await uploadUrlResponse.json();
        throw new Error(errorData.error || 'Failed to get upload URL');
      }

      const { uploadURL } = await uploadUrlResponse.json();
      setUploadProgress(25);

      // Step 2: Upload file directly to object storage
      const uploadResponse = await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to storage');
      }

      setUploadProgress(75);

      // Step 3: Save CV metadata to database
      const saveResponse = await fetch('/api/cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          fileUrl: uploadURL.split('?')[0], // Remove query params from URL
        }),
      });

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json();
        throw new Error(errorData.error || 'Failed to save CV information');
      }

      setUploadProgress(100);

      toast({
        title: "Success",
        description: "Your CV has been uploaded successfully!",
      });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Call completion callback
      onUploadComplete?.();

    } catch (error) {
      console.error('Error uploading CV:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload CV",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteCV = async () => {
    try {
      const response = await fetch('/api/cv', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete CV');
      }

      toast({
        title: "Success",
        description: "CV deleted successfully",
      });

      onUploadComplete?.();
    } catch (error) {
      console.error('Error deleting CV:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete CV",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-4" data-testid={dataTestId}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        onChange={handleFileChange}
        className="hidden"
      />

      {currentCV?.fileName ? (
        // Show current CV
        <div className="flex items-center justify-between p-4 border rounded-md bg-muted/20">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-blue-600" />
            <div>
              <p className="font-medium">{currentCV.fileName}</p>
              <p className="text-sm text-muted-foreground">
                {currentCV.fileSize ? formatFileSize(currentCV.fileSize) : 'Size unknown'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteCV}
              className="text-red-600 hover:text-red-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        // Show upload area
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
          <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-sm text-gray-600 mb-4">
            Upload your CV (PDF, DOC, or DOCX)
          </p>
          <Button
            onClick={handleFileSelect}
            disabled={uploading}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading... {uploadProgress}%
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Select CV File
              </>
            )}
          </Button>
          <p className="text-xs text-gray-500 mt-2">
            Maximum file size: 5MB
          </p>
        </div>
      )}

      {uploading && (
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}
    </div>
  );
}