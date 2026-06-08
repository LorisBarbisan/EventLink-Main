import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileText, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface JobDocumentsModalProps {
  jobId: number;
  jobTitle: string;
  open: boolean;
  onClose: () => void;
  isOwner?: boolean; // employer can delete
  onAttachFile?: () => void; // employer can upload
  isUploading?: boolean;
}

async function downloadDoc(doc: any) {
  try {
    const token = localStorage.getItem("auth_token");
    const res = await fetch(doc.downloadUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Download failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.fileName;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    window.open(doc.downloadUrl, "_blank");
  }
}

export function JobDocumentsModal({
  jobId,
  jobTitle,
  open,
  onClose,
  isOwner = false,
  onAttachFile,
  isUploading = false,
}: JobDocumentsModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: docs = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/job/${jobId}/documents`],
    enabled: open,
    retry: false,
  });

  const handleDelete = async (docId: number) => {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/job/${jobId}/documents/${docId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Delete failed");
      queryClient.invalidateQueries({ queryKey: [`/api/job/${jobId}/documents`] });
      toast({ title: "Document removed" });
    } catch {
      toast({ title: "Failed to remove document", variant: "destructive" });
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>📎</span> Job Documents
          </DialogTitle>
          <p className="text-sm text-muted-foreground truncate">{jobTitle}</p>
        </DialogHeader>

        <div className="space-y-2 max-h-80 overflow-y-auto py-1">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map(i => (
                <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : docs.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <FileText className="mx-auto mb-2 h-8 w-8 opacity-30" />
              No documents attached yet.
            </div>
          ) : (
            docs.map((doc: any) => (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 hover:bg-muted/40 transition-colors"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-orange-500" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{doc.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.documentType === "function_sheet"
                        ? "Function Sheet"
                        : doc.documentType === "purchase_order"
                        ? "Purchase Order"
                        : doc.documentType || "Document"}
                      {doc.fileSize ? ` · ${formatSize(doc.fileSize)}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => downloadDoc(doc)}
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(doc.id)}
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {isOwner && onAttachFile && (
          <div className="border-t pt-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={onAttachFile}
              disabled={isUploading}
            >
              <span className="mr-2">📎</span>
              {isUploading ? "Uploading..." : "+ Attach file"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
