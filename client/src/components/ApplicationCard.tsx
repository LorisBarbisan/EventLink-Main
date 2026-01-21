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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useReportRating } from "@/hooks/useRatings";
import { apiRequest } from "@/lib/queryClient";
import type { Job } from "@shared/schema";
import type { JobApplication } from "@shared/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle,
  Eye,
  Flag,
  MessageCircle,
  Quote,
  Send,
  Star,
  Trash2,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import React, { useState } from "react";
import { MessageModal } from "./MessageModal";
import { RatingDialog } from "./RatingDialog";
import { RatingRequestDialog } from "./RatingRequestDialog";

interface ApplicationCardProps {
  application: JobApplication;
  userType: "freelancer" | "recruiter";
  currentUserId: number;
}

export function ApplicationCard({ application, userType, currentUserId }: ApplicationCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [showHireConfirm, setShowHireConfirm] = useState(false);
  const [rejectionMessage, setRejectionMessage] = useState("");
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [showRatingRequestDialog, setShowRatingRequestDialog] = useState(false);
  const [showJobDetailsDialog, setShowJobDetailsDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [showMessageModal, setShowMessageModal] = useState(false);

  // Report review state
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedRatingId, setSelectedRatingId] = useState<number | null>(null);
  const [reportReason, setReportReason] = useState("");
  const { mutate: reportRating, isPending: isReporting } = useReportRating();

  const handleReportClick = (ratingId: number) => {
    setSelectedRatingId(ratingId);
    setReportReason("");
    setReportOpen(true);
  };

  const submitReport = () => {
    if (selectedRatingId && reportReason.trim()) {
      reportRating(
        { ratingId: selectedRatingId, reason: reportReason },
        {
          onSuccess: () => {
            setReportOpen(false);
          },
        }
      );
    }
  };

  // Fetch full job details when dialog opens
  const { data: jobDetails, isLoading: jobDetailsLoading } = useQuery<Job>({
    queryKey: [`/api/jobs/${application.job_id}`],
    queryFn: () => apiRequest(`/api/jobs/${application.job_id}`),
    enabled: showJobDetailsDialog && !!application.job_id,
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/applications/${application.id}/reject`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: rejectionMessage }),
      });
    },
    onSuccess: async () => {
      // Invalidate and refetch all application-related queries
      await queryClient.invalidateQueries({
        queryKey: ["/api/recruiter", currentUserId, "applications"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["/api/freelancer/applications", application.freelancer_id],
      });

      setShowRejectionDialog(false);
      setRejectionMessage("");
      toast({
        title: "Application rejected",
        description: "The applicant has been notified with your message.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reject application.",
        variant: "destructive",
      });
    },
  });

  const hireMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/applications/${application.id}/accept`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: async () => {
      // Invalidate and refetch all related queries
      await queryClient.invalidateQueries({
        queryKey: ["/api/recruiter", currentUserId, "applications"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["/api/jobs"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["/api/jobs/recruiter", currentUserId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["/api/freelancer/applications", application.freelancer_id],
      });

      setShowHireConfirm(false);
      toast({
        title: "Applicant hired!",
        description:
          "The applicant has been notified of their successful application. The job has been closed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to hire applicant.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/applications/${application.id}`, {
        method: "DELETE",
      });
    },
    onSuccess: async () => {
      setShowDeleteConfirm(false);

      // Invalidate application queries
      if (userType === "freelancer") {
        await queryClient.invalidateQueries({
          queryKey: ["/api/freelancer/applications", currentUserId],
        });
      } else {
        await queryClient.invalidateQueries({
          queryKey: ["/api/recruiter", currentUserId, "applications"],
        });
      }

      toast({
        title: userType === "freelancer" ? "Application removed" : "Application hidden",
        description:
          userType === "freelancer"
            ? "The application has been removed from your list."
            : "The application has been hidden from your view.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete application.",
        variant: "destructive",
      });
    },
  });

  const handleConfirmReject = () => {
    rejectMutation.mutate();
  };

  const handleConfirmHire = () => {
    hireMutation.mutate();
  };

  const handleConfirmDelete = () => {
    deleteMutation.mutate();
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "hired":
        return "default";
      case "reviewed":
        return "secondary";
      case "rejected":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "hired":
        return <CheckCircle className="w-4 h-4" />;
      case "rejected":
        return <X className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-medium">
                {userType === "recruiter"
                  ? application.freelancer_profile
                    ? `${application.freelancer_profile.first_name} ${application.freelancer_profile.last_name}`
                    : "Freelancer"
                  : application.job_title || "Job Application"}
              </h4>
              <Badge
                variant={getStatusBadgeVariant(application.status)}
                className="flex items-center gap-1"
              >
                {getStatusIcon(application.status)}
                {application.status}
              </Badge>
            </div>

            {userType === "recruiter" ? (
              <p className="text-sm text-muted-foreground mb-2">
                Applied for: {application.job_title}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mb-2">
                Company: {application.job_company}
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
              {userType === "recruiter" && application.freelancer_profile && (
                <>
                  <div>
                    Experience:{" "}
                    {application.freelancer_profile.experience_years
                      ? `${application.freelancer_profile.experience_years} years`
                      : "Not specified"}
                  </div>
                </>
              )}
              <div>Applied: {new Date(application.applied_at).toLocaleDateString()}</div>
            </div>

            {application.cover_letter && (
              <div className="mt-3">
                <p className="text-sm font-medium mb-1">Cover Letter:</p>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {application.cover_letter}
                </p>
              </div>
            )}

            {application.rejection_message && application.status === "rejected" && (
              <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                  Rejection Reason:
                </p>
                <p className="text-sm text-red-700 dark:text-red-300">
                  {application.rejection_message}
                </p>
                <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
                  <DialogTrigger asChild>
                    <Button
                      variant="link"
                      size="sm"
                      className="text-red-600 hover:text-red-700 p-0 h-auto"
                    >
                      View Details
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Application Rejection Details</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <p className="font-medium">Job: {application.job_title}</p>
                        <p className="text-sm text-muted-foreground">
                          Company: {application.job_company}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium mb-2">Rejection Message:</p>
                        <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                          {application.rejection_message}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Rejected on: {new Date(application.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2 sm:ml-4 w-full sm:w-auto">
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto justify-end">
              {userType === "recruiter" && application.freelancer_profile && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      window.open(`/profile/${application.freelancer_profile?.user_id}`, "_blank")
                    }
                    data-testid={`button-view-profile-${application.freelancer_profile.user_id}`}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Profile
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMessageModal(true)}
                    data-testid={`button-message-${application.freelancer_profile.user_id}`}
                  >
                    <MessageCircle className="w-4 h-4 mr-1" />
                    Message
                  </Button>

                  {(application.status === "applied" ||
                    application.status === "pending" ||
                    application.status === "reviewed") && (
                    <>
                      {/* Hire Confirmation Dialog */}
                      <AlertDialog open={showHireConfirm} onOpenChange={setShowHireConfirm}>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="default"
                            size="sm"
                            disabled={hireMutation.isPending}
                            data-testid={`button-hire-${application.id}`}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <UserCheck className="w-4 h-4 mr-1" />
                            Accept
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Accept Application</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to accept this application from{" "}
                              <strong>
                                {application.freelancer_profile
                                  ? `${application.freelancer_profile.first_name} ${application.freelancer_profile.last_name}`
                                  : "this freelancer"}
                              </strong>{" "}
                              for the position <strong>&quot;{application.job_title}&quot;</strong>?
                              <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                <p className="text-sm text-green-700 dark:text-green-300">
                                  The applicant will be notified immediately and can start
                                  coordination with you.
                                </p>
                              </div>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={hireMutation.isPending}>
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleConfirmHire}
                              disabled={hireMutation.isPending}
                              className="bg-green-600 hover:bg-green-700 text-white"
                              data-testid={`button-confirm-hire-${application.id}`}
                            >
                              {hireMutation.isPending ? "Accepting..." : "Yes, Accept Application"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      {/* Reject Dialog with Message Input */}
                      <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={rejectMutation.isPending}
                            data-testid={`button-reject-${application.id}`}
                            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            <UserX className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Reject Application</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <p className="text-sm text-muted-foreground">
                                You are about to reject the application from{" "}
                                <strong>
                                  {application.freelancer_profile
                                    ? `${application.freelancer_profile.first_name} ${application.freelancer_profile.last_name}`
                                    : "this freelancer"}
                                </strong>{" "}
                                for <strong>&quot;{application.job_title}&quot;</strong>.
                              </p>
                            </div>
                            <div>
                              <Label htmlFor="rejection-message">
                                Rejection message{" "}
                                <span className="text-muted-foreground">
                                  (optional but recommended)
                                </span>
                              </Label>
                              <Textarea
                                id="rejection-message"
                                placeholder="Provide constructive feedback to help the applicant improve future applications..."
                                value={rejectionMessage}
                                onChange={e => setRejectionMessage(e.target.value)}
                                className="mt-2 min-h-[100px]"
                                data-testid={`textarea-rejection-message-${application.id}`}
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                This message will be sent to the applicant along with the rejection
                                notification.
                              </p>
                            </div>
                          </div>
                          <DialogFooter className="gap-2">
                            <Button
                              variant="outline"
                              onClick={() => setShowRejectionDialog(false)}
                              disabled={rejectMutation.isPending}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={handleConfirmReject}
                              disabled={rejectMutation.isPending}
                              data-testid={`button-confirm-reject-${application.id}`}
                            >
                              {rejectMutation.isPending ? "Rejecting..." : "Reject Application"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </>
                  )}

                  {/* Rating button for hired applications */}
                  {application.status === "hired" &&
                    (application.rating ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800 rounded-md">
                          <Star className="w-4 h-4 fill-current" />
                          <span className="text-sm font-medium">Rated: {application.rating}/5</span>
                        </div>
                        {application.review && (
                          <div className="mt-2 text-sm italic text-muted-foreground bg-muted/50 p-3 rounded-md relative group">
                            <Quote className="w-3 h-3 text-muted-foreground/30 absolute top-2 left-2" />
                            <p className="pl-4">&quot;{application.review}&quot;</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowRatingDialog(true)}
                        data-testid={`button-rate-${application.id}`}
                        className="border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Star className="w-4 h-4 mr-1" />
                        Rate Freelancer
                      </Button>
                    ))}

                  {/* Delete button for recruiters to hide applications */}
                  <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-${application.id}`}
                        className="border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-700"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Hide
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Hide Application</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to hide this application from{" "}
                          <strong>
                            {application.freelancer_profile
                              ? `${application.freelancer_profile.first_name} ${application.freelancer_profile.last_name}`
                              : "this freelancer"}
                          </strong>
                          ? This will remove it from your applications list, but the freelancer will
                          still see it.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteMutation.isPending}>
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleConfirmDelete}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-confirm-delete-${application.id}`}
                          className="bg-gray-600 hover:bg-gray-700 text-white"
                        >
                          {deleteMutation.isPending ? "Hiding..." : "Yes, Hide Application"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}

              {/* Actions for freelancers viewing their own applications */}
              {userType === "freelancer" && (
                <>
                  <div className="flex flex-wrap gap-2 justify-end w-full items-center">
                    <Dialog open={showJobDetailsDialog} onOpenChange={setShowJobDetailsDialog}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid={`button-view-details-${application.id}`}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View Details
                        </Button>
                      </DialogTrigger>

                      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Job Details</DialogTitle>
                        </DialogHeader>

                        {jobDetailsLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="text-center">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                              <p className="text-sm text-muted-foreground mt-2">
                                Loading job details...
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-6">
                            {/* Header Info */}
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-lg">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <p className="font-medium text-sm text-muted-foreground mb-1">
                                    Job Title
                                  </p>
                                  <p className="font-bold text-lg">
                                    {jobDetails?.title ||
                                      application.job_title ||
                                      "No title available"}
                                  </p>
                                </div>
                                <div>
                                  <p className="font-medium text-sm text-muted-foreground mb-1">
                                    Company
                                  </p>
                                  <p className="font-semibold text-lg">
                                    {jobDetails?.company ||
                                      application.job_company ||
                                      "Company not specified"}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Job Information */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              <div>
                                <p className="font-medium text-sm text-muted-foreground mb-1">
                                  Location
                                </p>
                                <p className="font-medium">
                                  {jobDetails?.location || "Location not specified"}
                                </p>
                              </div>
                              <div>
                                <p className="font-medium text-sm text-muted-foreground mb-1">
                                  Job Type
                                </p>
                                <p className="capitalize font-medium">
                                  {jobDetails?.type || "Type not specified"}
                                </p>
                              </div>
                              <div>
                                <p className="font-medium text-sm text-muted-foreground mb-1">
                                  Status
                                </p>
                                <p className="capitalize font-medium">
                                  {jobDetails?.status || "Not specified"}
                                </p>
                              </div>
                            </div>

                            {/* Rate */}
                            <div>
                              <p className="font-medium text-sm text-muted-foreground mb-1">
                                Rate/Salary
                              </p>
                              <p className="font-medium text-green-600">
                                {jobDetails?.rate || "Rate not specified"}
                              </p>
                            </div>

                            {/* Description */}
                            {jobDetails?.description && (
                              <div>
                                <p className="font-medium text-sm text-muted-foreground mb-2">
                                  Job Description
                                </p>
                                <div className="p-4 bg-muted rounded-lg max-h-48 overflow-y-auto">
                                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                                    {jobDetails.description}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Job Status */}
                            <div>
                              <p className="font-medium text-sm text-muted-foreground mb-1">
                                Job Status
                              </p>
                              <Badge
                                variant={jobDetails?.status === "active" ? "default" : "secondary"}
                              >
                                {jobDetails?.status
                                  ? jobDetails.status.charAt(0).toUpperCase() +
                                    jobDetails.status.slice(1)
                                  : "Unknown"}
                              </Badge>
                            </div>

                            {/* Job Dates */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                              <div>
                                <p className="font-medium mb-1">Job Posted</p>
                                <p>
                                  {jobDetails?.created_at
                                    ? new Date(jobDetails.created_at).toLocaleDateString("en-GB", {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "numeric",
                                      })
                                    : "Date not available"}
                                </p>
                              </div>
                              <div>
                                <p className="font-medium mb-1">Last Updated</p>
                                <p>
                                  {jobDetails?.updated_at
                                    ? new Date(jobDetails.updated_at).toLocaleDateString("en-GB", {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "numeric",
                                      })
                                    : "Date not available"}
                                </p>
                              </div>
                            </div>

                            {/* Application Status */}
                            <div>
                              <p className="font-medium text-sm text-muted-foreground mb-1">
                                Application Status
                              </p>
                              <Badge
                                variant={
                                  application.status === "hired"
                                    ? "default"
                                    : application.status === "rejected"
                                      ? "destructive"
                                      : application.status === "reviewed"
                                        ? "secondary"
                                        : "outline"
                                }
                              >
                                {application.status === "hired"
                                  ? "Hired"
                                  : application.status === "rejected"
                                    ? "Rejected"
                                    : application.status === "reviewed"
                                      ? "Under Review"
                                      : "Pending"}
                              </Badge>
                            </div>
                          </div>
                        )}

                        {/* Application-specific information - always shown */}
                        {application.cover_letter && (
                          <div>
                            <p className="font-medium text-sm text-muted-foreground mb-2">
                              Your Cover Letter
                            </p>
                            <div className="p-3 bg-muted rounded-lg">
                              <p className="text-sm whitespace-pre-wrap">
                                {application.cover_letter}
                              </p>
                            </div>
                          </div>
                        )}

                        {application.rejection_message && application.status === "rejected" && (
                          <div>
                            <p className="font-medium text-sm text-muted-foreground mb-2">
                              Rejection Message
                            </p>
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                              <p className="text-sm text-red-700 dark:text-red-300">
                                {application.rejection_message}
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                          <div>
                            <p className="font-medium mb-1">Applied On</p>
                            <p>
                              {new Date(application.applied_at).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })}
                            </p>
                          </div>
                          <div>
                            <p className="font-medium mb-1">Last Updated</p>
                            <p>
                              {new Date(application.updated_at).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })}
                            </p>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {/* Message button for freelancers */}
                    {application.recruiter_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowMessageModal(true)}
                        data-testid={`button-message-recruiter-${application.id}`}
                      >
                        <MessageCircle className="w-4 h-4 mr-1" />
                        Message Recruiter
                      </Button>
                    )}

                    {application.status === "hired" && application.rating && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800 rounded-md">
                        <Star className="w-4 h-4 fill-current" />
                        <span className="text-sm font-medium">Rated: {application.rating}/5</span>
                      </div>
                    )}

                    {/* Rating request button for hired/completed jobs */}
                    {application.status === "hired" &&
                      (application.rating ? null : application.has_requested_rating ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-md">
                          <Send className="w-4 h-4 fill-current" />
                          <span className="text-sm font-medium">Rating Pending</span>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowRatingRequestDialog(true)}
                          data-testid={`button-request-rating-${application.id}`}
                          className="border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Send className="w-4 h-4 mr-1" />
                          Request Rating
                        </Button>
                      ))}

                    {/* Delete button for freelancers - visible and accessible */}
                    <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-freelancer-${application.id}`}
                          className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Remove
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Application</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove your application for{" "}
                            <strong>&quot;{application.job_title}&quot;</strong>? This action cannot
                            be undone and the application will be permanently removed from your from
                            your list.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={deleteMutation.isPending}>
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleConfirmDelete}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-confirm-delete-freelancer-${application.id}`}
                            className="bg-red-600 hover:bg-red-700 text-white"
                          >
                            {deleteMutation.isPending ? "Removing..." : "Yes, Remove Application"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </>
              )}
            </div>

            {application.review && (
              <div className="flex flex-col items-end gap-2 text-right max-w-md ml-auto">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Review: </span>
                  <span className="italic">&quot;{application.review}&quot;</span>
                </p>
                {userType === "freelancer" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-muted-foreground hover:text-destructive gap-1"
                    onClick={() => handleReportClick(application.id)}
                  >
                    <Flag className="w-3 h-3" />
                    Report Review
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>

      {/* Rating Dialog for recruiters */}
      {userType === "recruiter" && (
        <RatingDialog
          open={showRatingDialog}
          onOpenChange={setShowRatingDialog}
          application={application}
          currentUserId={currentUserId}
        />
      )}

      {/* Rating Request Dialog for freelancers */}
      {userType === "freelancer" && (
        <RatingRequestDialog
          open={showRatingRequestDialog}
          onOpenChange={setShowRatingRequestDialog}
          application={application}
          currentUserId={currentUserId}
        />
      )}

      {/* Message Modal for freelancers to message recruiters */}
      {userType === "freelancer" && application.recruiter_id && (
        <MessageModal
          isOpen={showMessageModal}
          onClose={() => setShowMessageModal(false)}
          recipientId={application.recruiter_id!}
          recipientName={application.job_company || "Recruiter"}
          senderId={currentUserId}
        />
      )}

      {/* Message Modal for recruiters to message freelancers */}
      {userType === "recruiter" && application.freelancer_id && application.freelancer_profile && (
        <MessageModal
          isOpen={showMessageModal}
          onClose={() => setShowMessageModal(false)}
          recipientId={application.freelancer_id!}
          recipientName={`${application.freelancer_profile?.first_name} ${application.freelancer_profile?.last_name}`}
          senderId={currentUserId}
        />
      )}
      {/* Report Review Dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Review</DialogTitle>
            <DialogDescription>
              Please provide a reason for reporting this review. We investigate all reports.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                placeholder="e.g. False claims, Abusive language, Not my project..."
                value={reportReason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setReportReason(e.target.value)
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitReport}
              disabled={!reportReason.trim() || isReporting}
              variant="destructive"
            >
              {isReporting ? "Submitting..." : "Submit Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
