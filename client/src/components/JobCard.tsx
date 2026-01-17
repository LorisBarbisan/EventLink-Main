import { MessageModal } from "@/components/MessageModal";
import { RatingDialog } from "@/components/RatingDialog";
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
import type { Job, JobApplication } from "@shared/types";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  Edit,
  Eye,
  MapPin,
  MessageCircle,
  Star,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { useState } from "react";

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
}: JobCardProps) {
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [selectedFreelancer, setSelectedFreelancer] = useState<{ id: number; name: string } | null>(
    null
  );
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<JobApplication | null>(null);

  // Helper function to format duration display
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
    // Navigate directly to the freelancer's profile page
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

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold">{job.title}</h3>
              <Badge
                variant={
                  job.status === "active"
                    ? "default"
                    : job.status === "paused"
                      ? "secondary"
                      : "outline"
                }
              >
                {job.status}
              </Badge>
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
                <Coins className="w-4 h-4" />
                {job.rate}
              </div>
              {job.event_date && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Event: {new Date(job.event_date).toLocaleDateString()}
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
              {showHiredSection && hiredApplicants.length > 0 && onExpandToggle && (
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
                      View Hired ({hiredApplicants.length})
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-row gap-2 sm:ml-4 w-full sm:w-auto justify-end sm:justify-start">
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(job.id)}
                data-testid={`button-edit-job-${job.id}`}
              >
                <Edit className="w-4 h-4" />
              </Button>
            )}
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

        {/* Hired Applicants Details - Expandable Section */}
        {showHiredSection && isExpanded && hiredApplicants.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <User className="w-4 h-4" />
              Hired Freelancers
            </h4>
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

                  {/* Review Display Section */}
                  {(applicant as any).review && (
                    <div className="mt-2 flex flex-col items-end">
                      <div className="text-right max-w-md">
                        <span className="text-xs font-semibold text-muted-foreground mr-1">
                          Review: Review:
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
      </CardContent>

      {/* Message Modal */}
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

      {/* Rating Dialog */}
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
