import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { MapPin, Calendar, Users, Edit, Trash2, Coins, ChevronDown, ChevronUp, User, MessageCircle, Eye, Clock } from 'lucide-react';
import { MessageModal } from '@/components/MessageModal';
import type { Job, JobApplication } from '@shared/types';

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
  currentUserId = 0
}: JobCardProps) {
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [selectedFreelancer, setSelectedFreelancer] = useState<{id: number, name: string} | null>(null);

  // Helper function to format duration display
  const formatDuration = (job: Job): string | null => {
    if (!job.duration_type) return null;
    
    switch (job.duration_type) {
      case 'time':
        if (job.start_time && job.end_time) {
          return `${job.start_time} - ${job.end_time}`;
        }
        return null;
      case 'days':
        if (job.days) {
          return `${job.days} day${job.days !== 1 ? 's' : ''}`;
        }
        return null;
      case 'hours':
        if (job.hours) {
          return `${job.hours} hour${job.hours !== 1 ? 's' : ''}`;
        }
        return null;
      default:
        return null;
    }
  };

  const handleProfileView = (userId: number) => {
    // Navigate directly to the freelancer's profile page
    window.open(`/profile/${userId}`, '_blank');
  };

  const handleMessageFreelancer = (applicant: JobApplication) => {
    const freelancerName = applicant.freelancer_profile?.first_name && applicant.freelancer_profile?.last_name
      ? `${applicant.freelancer_profile.first_name} ${applicant.freelancer_profile.last_name}`
      : `Freelancer ${applicant.freelancer_id}`;
    
    setSelectedFreelancer({
      id: applicant.freelancer_id,
      name: freelancerName
    });
    setMessageModalOpen(true);
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold">{job.title}</h3>
              <Badge variant={job.status === 'active' ? 'default' : job.status === 'paused' ? 'secondary' : 'outline'}>
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
              {formatDuration(job) && (
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatDuration(job)}
                </div>
              )}
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Posted {new Date(job.created_at).toLocaleDateString()}
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground mb-2">{job.description}</p>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-sm">
                <Users className="w-4 h-4" />
                <span>{applicantCount} {applicantCount === 1 ? 'applicant' : 'applicants'}</span>
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
          
          <div className="flex gap-2 ml-4">
            {onEdit && (
              <Button variant="outline" size="sm" onClick={() => onEdit(job.id)} data-testid={`button-edit-job-${job.id}`}>
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
                      Are you sure you want to delete "{job.title}"? This action cannot be undone.
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
              {hiredApplicants.map((applicant) => (
                <div 
                  key={applicant.id}
                  className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center font-medium">
                      {applicant.freelancer_profile?.first_name?.[0] || 'F'}
                      {applicant.freelancer_profile?.last_name?.[0] || ''}
                    </div>
                    <div>
                      <h5 className="font-medium">
                        {applicant.freelancer_profile?.first_name && applicant.freelancer_profile?.last_name 
                          ? `${applicant.freelancer_profile.first_name} ${applicant.freelancer_profile.last_name}`
                          : `Freelancer ${applicant.freelancer_id}`
                        }
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
                  </div>
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
    </Card>
  );
}