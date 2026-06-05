import { MessageModal } from "@/components/MessageModal";
import { RatingDialog } from "@/components/RatingDialog";
import { ShareJobButton } from "@/components/ShareJobButton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { Job, JobApplication } from "@shared/types";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  PoundSterling,
  Edit,
  Eye,
  EyeOff,
  Lock,
  MapPin,
  MessageCircle,
  Copy,
  RotateCcw,
  Send,
  Star,
  Trash2,
  User,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface JobCardProps {
  job: Job;
  hiredApplicants: JobApplication[];
  applicantCount?: number;
  onEdit?: (jobId: number) => void;
  onDelete?: (jobId: number) => void;
  onExpandToggle?: (jobId: number) => void;
  isExpanded?: boolean;
  showHiredSection?: boolean;
  currentUserId?: number;
  onPublish?: (jobId: number) => void;
  onUnpublish?: (jobId: number) => void;
  onInvite?: (jobId: number) => void;
  onViewInvited?: (jobId: number) => void;
  onClose?: (jobId: number) => void;
  onReopen?: (jobId: number) => void;
  onDuplicate?: (job: Job) => void;
  onViewDetail?: (jobId: number) => void;
  invitedCount?: number;
}

export function JobCard({
  job,
  hiredApplicants,
  applicantCount = 0,
  onEdit,
  onDelete,
  onExpandToggle,
  isExpanded = false,
  showHiredSection = true,
  currentUserId = 0,
  onPublish,
  onUnpublish,
  onInvite,
  onViewInvited,
  onClose,
  onReopen,
  onDuplicate,
  onViewDetail,
  invitedCount = 0,
}: JobCardProps) {
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [selectedFreelancer, setSelectedFreelancer] = useState<{ id: number; name: string } | null>(
    null
  );
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<JobApplication | null>(null);
  const { toast } = useToast();

  // Document upload state
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showUploadWarning, setShowUploadWarning] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("function_sheet");
  const [customDocName, setCustomDocName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);

  const { data: rawDocuments } = useQuery<any[]>({
    queryKey: [`/api/job/${job.id}/documents`],
    enabled: isExpanded || showDocuments,
  });
  const documents: any[] = Array.isArray(rawDocuments) ? rawDocuments : [];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setShowUploadWarning(true);
    e.target.value = "";
  };

  const confirmUpload = async () => {
    if (!pendingFile) return;
    setShowUploadWarning(false);
    setUploading(true);
    try {
      const effectiveDocType = docType === "other" && customDocName.trim()
        ? customDocName.trim()
        : docType;

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(pendingFile);
      });

      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/job/${job.id}/documents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          fileData: base64,
          filename: pendingFile.name,
          contentType: pendingFile.type,
          documentType: effectiveDocType,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || `Upload failed (${res.status})`);
      }
      queryClient.invalidateQueries({ queryKey: [`/api/job/${job.id}/documents`] });
      toast({ title: "Document uploaded", description: pendingFile.name });
      setCustomDocName("");
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message || "Please try again", variant: "destructive" });
    } finally {
      setUploading(false);
      setPendingFile(null);
    }
  };

  const deleteDocument = async (docId: number) => {
    const token = localStorage.getItem("auth_token");
    await fetch(`/api/job/${job.id}/documents/${docId}`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    queryClient.invalidateQueries({ queryKey: [`/api/job/${job.id}/documents`] });
  };

  const formatDuration = (job: Job): string | null => {
    if (!job.duration_type) return null;

    switch (job.duration_type) {
      case "time":
        if (job.start_time && job.end_time) {
          return `${job.start_time} - ${job.end_time}`;
        }
        return null;
      case "days":
        if (job.days) {
          return `${job.days} day${job.days !== 1 ? "s" : ""}`;
        }
        return null;
      case "hours":
        if (job.hours) {
          return `${job.hours} hour${job.hours !== 1 ? "s" : ""}`;
        }
        return null;
      default:
        return null;
    }
  };

  const handleProfileView = (userId: number) => {
    window.open(`/profile/${userId}`, "_blank");
  };

  const handleMessageFreelancer = (applicant: JobApplication) => {
    const freelancerName =
      applicant.freelancer_profile?.first_name && applicant.freelancer_profile?.last_name
        ? `${applicant.freelancer_profile.first_name} ${applicant.freelancer_profile.last_name}`
        : `Freelancer ${applicant.freelancer_id}`;

    setSelectedFreelancer({
      id: applicant.freelancer_id,
      name: freelancerName,
    });
    setMessageModalOpen(true);
  };

  const handleRateFreelancer = (applicant: JobApplication) => {
    setSelectedApplication(applicant);
    setShowRatingDialog(true);
  };

  const isClosed = job.status === "closed";
  const isPosted = job.status === "active";
  const isUnposted = job.status === "private";

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <h3
                className={`text-lg font-semibold ${onViewDetail ? "cursor-pointer hover:text-primary hover:underline" : ""}`}
                onClick={() => onViewDetail?.(job.id)}
              >
                {job.title}
              </h3>
              {isPosted && (
                <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-green-200">
                  <Eye className="w-3 h-3 mr-1" />
                  Posted
                </Badge>
              )}
              {isUnposted && (
                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200">
                  <Lock className="w-3 h-3 mr-1" />
                  Unposted
                </Badge>
              )}
              {isClosed && (
                <Badge className="bg-red-100 text-red-800 hover:bg-red-200 border-red-200">
                  <XCircle className="w-3 h-3 mr-1" />
                  Closed
                </Badge>
              )}
              {!isClosed && (
                <Badge variant="outline" className="text-blue-700 border-blue-300">
                  Open
                </Badge>
              )}
              {invitedCount > 0 && (
                <Badge
                  variant="outline"
                  className={`text-blue-600 border-blue-200 bg-blue-50 ${
                    onViewInvited ? "cursor-pointer hover:bg-blue-100" : ""
                  }`}
                  onClick={() => onViewInvited?.(job.id)}
                >
                  <UserPlus className="w-3 h-3 mr-1" />
                  {invitedCount} invited
                </Badge>
              )}
              {showHiredSection && hiredApplicants.length > 0 && (
                <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                  {hiredApplicants.length} hired
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-muted-foreground mb-3">
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {job.location}
              </div>
              <div className="flex items-center gap-1">
                <PoundSterling className="w-4 h-4" />
                {job.rate}
              </div>
              {job.event_date && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(job.event_date).toLocaleDateString()}
                  {job.end_date && ` - ${new Date(job.end_date).toLocaleDateString()}`}
                </div>
              )}
              {formatDuration(job) && (
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatDuration(job)}
                </div>
              )}
            </div>

            <p className="text-sm text-muted-foreground mb-2">{job.description}</p>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-sm">
                <Users className="w-4 h-4" />
                <span>
                  {applicantCount} {applicantCount === 1 ? "applicant" : "applicants"}
                </span>
              </div>
              {showHiredSection && (hiredApplicants.length > 0 || isClosed) && onExpandToggle && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onExpandToggle(job.id)}
                  data-testid={`button-expand-job-${job.id}`}
                  className="text-sm"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="w-4 h-4 mr-1" />
                      Hide Details
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4 mr-1" />
                      {hiredApplicants.length > 0 ? `View Hired (${hiredApplicants.length})` : "View Details"}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-row gap-2 sm:ml-4 w-full sm:w-auto justify-end sm:justify-start flex-wrap">
            {isClosed && (
              <span className="text-xs text-red-600 font-medium self-center mr-2">Closed</span>
            )}

            {/* 1. Post / Unpost */}
            {isUnposted && onPublish && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                    <Send className="w-4 h-4 mr-2" />
                    Post
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Post Job</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will make &quot;{job.title}&quot; visible to all freelancers on the Find Jobs page. Are you sure?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction className="bg-green-600 hover:bg-green-700" onClick={() => onPublish(job.id)}>
                      Post Job
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {isPosted && onUnpublish && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-amber-700 border-amber-200 hover:bg-amber-50 hover:text-amber-800">
                    <EyeOff className="w-4 h-4 mr-2" />
                    Unpost
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Unpost Job</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove &quot;{job.title}&quot; from the public Find Jobs page. Freelancers will only be able to access it via invitation. Are you sure?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction className="bg-amber-600 hover:bg-amber-700" onClick={() => onUnpublish(job.id)}>
                      Unpost Job
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* 2. Invite */}
            {!isClosed && onInvite && (
              <Button
                variant="outline"
                size="sm"
                className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                onClick={() => onInvite(job.id)}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Invite
              </Button>
            )}

            {/* 3. Docs */}
            {(onEdit || onDelete || onDuplicate) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDocuments(v => !v)}
                className={showDocuments ? "border-orange-300 text-orange-700 bg-orange-50" : "text-gray-600"}
                title="Job Documents"
              >
                <span className="text-sm mr-1.5">📎</span>
                <span className="hidden sm:inline">Docs</span>
                {documents.length > 0 && (
                  <span className="ml-1 text-xs bg-orange-100 text-orange-700 rounded-full px-1.5 py-0.5 font-medium">
                    {documents.length}
                  </span>
                )}
              </Button>
            )}

            {/* 4. Share */}
            {!isClosed && <ShareJobButton job={job} size="sm" />}

            {/* 5. Create similar */}
            {onDuplicate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDuplicate(job)}
                title="Create a new job pre-filled with this job's details"
                className="hidden sm:flex"
              >
                <Copy className="w-4 h-4 mr-2" />
                Create similar
              </Button>
            )}
            {onDuplicate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDuplicate(job)}
                title="Create similar job"
                className="sm:hidden"
              >
                <Copy className="w-4 h-4" />
              </Button>
            )}

            {/* 6. Edit */}
            {onEdit && !isClosed && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(job.id)}
                data-testid={`button-edit-job-${job.id}`}
              >
                <Edit className="w-4 h-4" />
              </Button>
            )}

            {/* 7. Close / Reopen */}
            {!isClosed && onClose && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700">
                    <XCircle className="w-4 h-4 mr-2" />
                    Close
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Close Job</AlertDialogTitle>
                    <AlertDialogDescription>
                      Closing &quot;{job.title}&quot; will stop all new applications and disable invitations. The job will remain visible in your dashboard. This action cannot be undone. Are you sure?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => onClose(job.id)}
                    >
                      Close Job
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {isClosed && onReopen && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-green-700 border-green-200 hover:bg-green-50 hover:text-green-800">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reopen
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reopen Job</AlertDialogTitle>
                    <AlertDialogDescription>
                      &quot;{job.title}&quot; will be reopened as an unposted draft. It won't be visible to freelancers until you post it manually. You can edit it before posting.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onReopen(job.id)}>Reopen Job</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* 8. Bin / Delete */}
            {onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" data-testid={`button-delete-job-${job.id}`}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Job Posting</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete &quot;{job.title}&quot;? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => onDelete(job.id)}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Upload warning modal */}
        {showUploadWarning && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
              <div className="text-4xl mb-4 text-center">📋</div>
              <h2 className="text-xl font-bold text-gray-900 mb-3 text-center">Before you upload</h2>
              <p className="text-gray-600 text-sm leading-relaxed mb-4 text-center">
                Once a freelancer is hired for this job, they will be able to view and download all
                documents you attach to it.
              </p>
              <p className="text-gray-500 text-sm leading-relaxed mb-6 text-center">
                Make sure the file does not contain any sensitive information you would not want the
                hired technician to see.
              </p>
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">Document type</label>
                <select
                  value={docType}
                  onChange={e => { setDocType(e.target.value); setCustomDocName(""); }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="function_sheet">Function Sheet</option>
                  <option value="purchase_order">Purchase Order</option>
                  <option value="other">Other</option>
                </select>
              </div>
              {docType === "other" && (
                <div className="mb-5">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Document name <span className="text-gray-400 font-normal">(e.g. NDA, Risk Assessment)</span>
                  </label>
                  <input
                    type="text"
                    value={customDocName}
                    onChange={e => setCustomDocName(e.target.value)}
                    placeholder="Enter document name..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    maxLength={60}
                  />
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={confirmUpload}
                  disabled={uploading}
                  className="flex-1 py-3 bg-orange-600 text-white font-semibold rounded-xl hover:bg-orange-700 disabled:opacity-50 transition-colors"
                >
                  {uploading ? "Uploading..." : "Upload"}
                </button>
                <button
                  onClick={() => { setShowUploadWarning(false); setPendingFile(null); }}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {showHiredSection && isExpanded && (
          <div className="mt-4 pt-4 border-t border-border">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <User className="w-4 h-4" />
              Hired Freelancers
            </h4>
            {hiredApplicants.length === 0 && (
              <p className="text-sm text-muted-foreground italic">No freelancers were hired for this job.</p>
            )}
            <div className="space-y-3">
              {hiredApplicants.map(applicant => (
                <div
                  key={applicant.id}
                  className="flex flex-col p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center font-medium">
                        {applicant.freelancer_profile?.first_name?.[0] || "F"}
                        {applicant.freelancer_profile?.last_name?.[0] || ""}
                      </div>
                      <div>
                        <h5 className="font-medium">
                          {applicant.freelancer_profile?.first_name &&
                          applicant.freelancer_profile?.last_name
                            ? `${applicant.freelancer_profile.first_name} ${applicant.freelancer_profile.last_name}`
                            : `Freelancer ${applicant.freelancer_id}`}
                        </h5>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {applicant.freelancer_profile?.title && (
                            <span>• {applicant.freelancer_profile.title}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleProfileView(applicant.freelancer_id)}
                        data-testid={`button-view-freelancer-${applicant.freelancer_id}`}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        View Profile
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMessageFreelancer(applicant)}
                        data-testid={`button-message-freelancer-${applicant.freelancer_id}`}
                      >
                        <MessageCircle className="w-3 h-3 mr-1" />
                        Message
                      </Button>
                      {(applicant as any).rating ? (
                        <div className="flex items-center gap-1 text-yellow-600 font-medium px-3 border border-transparent">
                          <Star className="w-3 h-3 fill-current" />
                          <span>{(applicant as any).rating}/5</span>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRateFreelancer(applicant)}
                          data-testid={`button-rate-freelancer-${applicant.freelancer_id}`}
                          className="border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Star className="w-3 h-3 mr-1" />
                          Rate
                        </Button>
                      )}
                    </div>
                  </div>

                  {(applicant as any).review && (
                    <div className="mt-2 flex flex-col items-end">
                      <div className="text-right max-w-md">
                        <span className="text-xs font-semibold text-muted-foreground mr-1">
                          Review:
                        </span>
                        <span className="text-sm text-muted-foreground italic">
                          &quot;{(applicant as any).review}&quot;
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Documents panel */}
        {showDocuments && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700">Job Documents</h4>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors font-medium"
              >
                + Attach file
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
            {documents.length === 0 ? (
              <p className="text-xs text-gray-400 italic">
                No documents attached. Add a function sheet or purchase order.
              </p>
            ) : (
              documents.map((doc: any) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg mb-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-gray-400 text-sm">📄</span>
                    <a
                      href={doc.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline truncate"
                    >
                      {doc.fileName}
                    </a>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {doc.documentType === "function_sheet"
                        ? "Function Sheet"
                        : doc.documentType === "purchase_order"
                        ? "Purchase Order"
                        : ""}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteDocument(doc.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors text-xs ml-2 flex-shrink-0"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>

      {selectedFreelancer && (
        <MessageModal
          isOpen={messageModalOpen}
          onClose={() => {
            setMessageModalOpen(false);
            setSelectedFreelancer(null);
          }}
          recipientId={selectedFreelancer.id}
          recipientName={selectedFreelancer.name}
          senderId={currentUserId}
        />
      )}

      {selectedApplication && (
        <RatingDialog
          open={showRatingDialog}
          onOpenChange={setShowRatingDialog}
          application={selectedApplication}
          currentUserId={currentUserId}
        />
      )}
    </Card>
  );
}
