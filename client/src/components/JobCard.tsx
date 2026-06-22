import { MessageModal } from "@/components/MessageModal";
import { JobDocumentsModal } from "@/components/JobDocumentsModal";
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
  const [showDocuments] = useState(false);
  const [showDocsModal, setShowDocsModal] = useState(false);

  const { data: rawDocuments } = useQuery<any[]>({
    queryKey: [`/api/job/${job.id}/documents`],
    enabled: isExpanded || showDocuments,
  });
  const documents: any[] = Array.isArray(rawDocuments) ? rawDocuments : [];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 10 MB. Please choose a smaller file.",
        variant: "destructive",
      });
      return;
    }
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (!allowed.includes(file.type)) {
      toast({
        title: "File type not supported",
        description: "Only PDF, Word (.doc/.docx), and Excel (.xls/.xlsx) files are allowed.",
        variant: "destructive",
      });
      return;
    }
    setPendingFile(file);
    setShowUploadWarning(true);
  };

  const confirmUpload = async () => {
    if (!pendingFile) return;
    setShowUploadWarning(false);
    setUploading(true);
    try {
      const effectiveDocType =
        docType === "other" && customDocName.trim() ? customDocName.trim() : docType;

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
      toast({
        title: "Upload failed",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setPendingFile(null);
    }
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3
                className={`text-lg font-semibold ${onViewDetail ? "cursor-pointer hover:text-primary hover:underline" : ""}`}
                onClick={() => onViewDetail?.(job.id)}
              >
                {job.title}
              </h3>
              {isPosted && (
                <Badge className="border-green-200 bg-green-100 text-green-800 hover:bg-green-200">
                  <Eye className="mr-1 h-3 w-3" />
                  Posted
                </Badge>
              )}
              {isUnposted && (
                <Badge className="border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-200">
                  <Lock className="mr-1 h-3 w-3" />
                  Unposted
                </Badge>
              )}
              {isClosed && (
                <Badge className="border-red-200 bg-red-100 text-red-800 hover:bg-red-200">
                  <XCircle className="mr-1 h-3 w-3" />
                  Closed
                </Badge>
              )}
              {!isClosed && (
                <Badge variant="outline" className="border-blue-300 text-blue-700">
                  Open
                </Badge>
              )}
              {invitedCount > 0 && (
                <Badge
                  variant="outline"
                  className={`border-blue-200 bg-blue-50 text-blue-600 ${
                    onViewInvited ? "cursor-pointer hover:bg-blue-100" : ""
                  }`}
                  onClick={() => onViewInvited?.(job.id)}
                >
                  <UserPlus className="mr-1 h-3 w-3" />
                  {invitedCount} invited
                </Badge>
              )}
              {showHiredSection && hiredApplicants.length > 0 && (
                <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                  {hiredApplicants.length} hired
                </Badge>
              )}
            </div>

            <div className="mb-3 grid grid-cols-1 gap-4 text-sm text-muted-foreground md:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {[job.location, (job as any).country].filter(Boolean).join(", ")}
              </div>
              <div className="flex items-center gap-1">
                <PoundSterling className="h-4 w-4" />
                {(job as any).currency && (job as any).currency !== "GBP"
                  ? `${(job as any).currency} `
                  : ""}
                {job.rate}
              </div>
              {job.event_date && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(job.event_date).toLocaleDateString()}
                  {job.end_date && ` - ${new Date(job.end_date).toLocaleDateString()}`}
                </div>
              )}
              {formatDuration(job) && (
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {formatDuration(job)}
                </div>
              )}
            </div>

            <p className="mb-2 text-sm text-muted-foreground">{job.description}</p>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-sm">
                <Users className="h-4 w-4" />
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
                      <ChevronUp className="mr-1 h-4 w-4" />
                      Hide Details
                    </>
                  ) : (
                    <>
                      <ChevronDown className="mr-1 h-4 w-4" />
                      {hiredApplicants.length > 0
                        ? `View Hired (${hiredApplicants.length})`
                        : "View Details"}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          <div className="flex w-full flex-row flex-wrap justify-end gap-2 sm:ml-4 sm:w-auto sm:justify-start">
            {isClosed && (
              <span className="mr-2 self-center text-xs font-medium text-red-600">Closed</span>
            )}

            {/* 1. Post / Unpost */}
            {isUnposted && onPublish && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" className="bg-green-600 text-white hover:bg-green-700">
                    <Send className="mr-2 h-4 w-4" />
                    Post
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Post Job</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will make &quot;{job.title}&quot; visible to all freelancers on the Find
                      Jobs page. Are you sure?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => onPublish(job.id)}
                    >
                      Post Job
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {isPosted && onUnpublish && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                  >
                    <EyeOff className="mr-2 h-4 w-4" />
                    Unpost
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Unpost Job</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove &quot;{job.title}&quot; from the public Find Jobs page.
                      Freelancers will only be able to access it via invitation. Are you sure?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-amber-600 hover:bg-amber-700"
                      onClick={() => onUnpublish(job.id)}
                    >
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
                className="border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                onClick={() => onInvite(job.id)}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Invite
              </Button>
            )}

            {/* 3. Docs */}
            {(onEdit || onDelete || onDuplicate) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDocsModal(true)}
                className="text-gray-600"
                title="Job Documents"
              >
                <span className="mr-1.5 text-sm">📎</span>
                <span className="hidden sm:inline">Docs</span>
                {documents.length > 0 && (
                  <span className="ml-1 rounded-full bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-700">
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
                <Copy className="mr-2 h-4 w-4" />
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
                <Copy className="h-4 w-4" />
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
                <Edit className="h-4 w-4" />
              </Button>
            )}

            {/* 7. Close / Reopen */}
            {!isClosed && onClose && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Close
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Close Job</AlertDialogTitle>
                    <AlertDialogDescription>
                      Closing &quot;{job.title}&quot; will stop all new applications and disable
                      invitations. The job will remain visible in your dashboard. This action cannot
                      be undone. Are you sure?
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reopen
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reopen Job</AlertDialogTitle>
                    <AlertDialogDescription>
                      &quot;{job.title}&quot; will be reopened as an unposted draft. It won&apos;t
                      be visible to freelancers until you post it manually. You can edit it before
                      posting.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onReopen(job.id)}>
                      Reopen Job
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* 8. Bin / Delete */}
            {onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" data-testid={`button-delete-job-${job.id}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Job Posting</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete &quot;{job.title}&quot;? This action cannot be
                      undone.
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
              <div className="mb-4 text-center text-4xl">📋</div>
              <h2 className="mb-3 text-center text-xl font-bold text-gray-900">
                Before you upload
              </h2>
              <p className="mb-4 text-center text-sm leading-relaxed text-gray-600">
                Once a freelancer is hired for this job, they will be able to view and download all
                documents you attach to it.
              </p>
              <p className="mb-4 text-center text-sm leading-relaxed text-gray-500">
                Make sure the file does not contain any sensitive information you would not want the
                hired technician to see.
              </p>
              <div className="mb-5 flex items-center justify-center gap-1.5 text-xs text-gray-400">
                <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5">
                  PDF
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5">
                  Word
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5">
                  Excel
                </span>
                <span className="text-gray-300">·</span>
                <span>Max 10 MB</span>
              </div>
              {pendingFile && (
                <div className="mb-4 truncate text-center text-xs text-gray-500">
                  <span className="font-medium text-gray-700">{pendingFile.name}</span>
                  <span className="ml-1">({(pendingFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                </div>
              )}
              <div className="mb-5">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Document type
                </label>
                <select
                  value={docType}
                  onChange={(e) => {
                    setDocType(e.target.value);
                    setCustomDocName("");
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="function_sheet">Function Sheet</option>
                  <option value="purchase_order">Purchase Order</option>
                  <option value="other">Other</option>
                </select>
              </div>
              {docType === "other" && (
                <div className="mb-5">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Document name{" "}
                    <span className="font-normal text-gray-400">(e.g. NDA, Risk Assessment)</span>
                  </label>
                  <input
                    type="text"
                    value={customDocName}
                    onChange={(e) => setCustomDocName(e.target.value)}
                    placeholder="Enter document name..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    maxLength={60}
                  />
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={confirmUpload}
                  disabled={uploading}
                  className="flex-1 rounded-xl bg-orange-600 py-3 font-semibold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
                >
                  {uploading ? "Uploading..." : "Upload"}
                </button>
                <button
                  onClick={() => {
                    setShowUploadWarning(false);
                    setPendingFile(null);
                  }}
                  className="flex-1 rounded-xl border border-gray-300 py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {showHiredSection && isExpanded && (
          <div className="mt-4 border-t border-border pt-4">
            <h4 className="mb-3 flex items-center gap-2 font-medium">
              <User className="h-4 w-4" />
              Hired Freelancers
            </h4>
            {hiredApplicants.length === 0 && (
              <p className="text-sm italic text-muted-foreground">
                No freelancers were hired for this job.
              </p>
            )}
            <div className="space-y-3">
              {hiredApplicants.map((applicant) => (
                <div
                  key={applicant.id}
                  className="flex flex-col rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20"
                >
                  <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-600 font-medium text-white">
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
                        <Eye className="mr-1 h-3 w-3" />
                        View Profile
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMessageFreelancer(applicant)}
                        data-testid={`button-message-freelancer-${applicant.freelancer_id}`}
                      >
                        <MessageCircle className="mr-1 h-3 w-3" />
                        Message
                      </Button>
                      {(applicant as any).rating ? (
                        <div className="flex items-center gap-1 border border-transparent px-3 font-medium text-yellow-600">
                          <Star className="h-3 w-3 fill-current" />
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
                          <Star className="mr-1 h-3 w-3" />
                          Rate
                        </Button>
                      )}
                    </div>
                  </div>

                  {(applicant as any).review && (
                    <div className="mt-2 flex flex-col items-end">
                      <div className="max-w-md text-right">
                        <span className="mr-1 text-xs font-semibold text-muted-foreground">
                          Review:
                        </span>
                        <span className="text-sm italic text-muted-foreground">
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

        {/* Hidden file input for document upload (triggered from modal) */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Documents modal */}
        <JobDocumentsModal
          jobId={job.id}
          jobTitle={job.title}
          open={showDocsModal}
          onClose={() => setShowDocsModal(false)}
          isOwner={!!(onEdit || onDelete || onDuplicate)}
          canUpload={!!(onEdit || onDelete || onDuplicate)}
          onAttachFile={() => {
            setShowDocsModal(false);
            setTimeout(() => fileInputRef.current?.click(), 0);
          }}
          isUploading={uploading}
        />
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
