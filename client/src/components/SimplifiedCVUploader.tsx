import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Upload, FileText, Download, Trash2, CheckCircle } from 'lucide-react';

interface CVUploaderProps {
  userId: number;
  currentCV?: {
    fileName?: string;
    fileSize?: number;
    fileUrl?: string;
  };
  onUploadComplete?: () => void;
}

export function SimplifiedCVUploader({ userId, currentCV, onUploadComplete }: CVUploaderProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (file.type !== 'application/pdf') {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PDF file.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'File size must be less than 5MB.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    try {
      console.log('📤 Starting CV upload:', file.name, file.type, file.size);
      
      // Get upload URL
      console.log('Step 1: Requesting upload URL...');
      const { uploadUrl, objectKey } = await apiRequest('/api/cv/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
        }),
      });
      console.log('✅ Step 1: Got upload URL');

      // Upload file directly to cloud storage
      console.log('Step 2: Uploading file to storage...');
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('❌ Step 2 failed:', uploadResponse.status, errorText);
        throw new Error(`Failed to upload file to storage: ${uploadResponse.status} - ${errorText || 'Unknown error'}`);
      }
      console.log('✅ Step 2: File uploaded to storage');

      // Save CV metadata (including contentType)
      console.log('Step 3: Saving CV metadata...');
      await apiRequest('/api/cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectKey,
          filename: file.name,
          fileSize: file.size,
          contentType: file.type,
        }),
      });
      console.log('✅ Step 3: Metadata saved');

      toast({
        title: 'CV uploaded successfully',
        description: 'Your CV has been uploaded and saved.',
      });

      onUploadComplete?.();
    } catch (error) {
      console.error('❌ CV upload error:', error);
      console.error('Error type:', typeof error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      // Extract detailed error message
      let errorMessage = "Failed to upload CV. Please try again.";
      if (error instanceof Error) {
        errorMessage = error.message;
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      } else if (typeof error === 'object' && error !== null && 'error' in error) {
        errorMessage = String((error as any).error);
      }
      
      toast({
        title: 'Upload failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await apiRequest('/api/cv', {
        method: 'DELETE',
      });

      toast({
        title: 'CV deleted',
        description: 'Your CV has been removed.',
      });

      onUploadComplete?.();
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: 'Failed to delete CV. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
                    onClick={() => window.open(`/api/cv/download/${userId}`, '_blank')}
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
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
            
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Want to upload a new CV?</p>
              <label htmlFor="cv-file-replace">
                <Button variant="outline" disabled={isUploading} asChild>
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    {isUploading ? 'Uploading...' : 'Replace CV'}
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
                  {isUploading ? 'Uploading...' : 'Upload CV'}
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