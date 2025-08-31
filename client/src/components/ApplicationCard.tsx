import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Eye, MessageCircle, CheckCircle, X, AlertCircle, UserCheck, UserX } from 'lucide-react';
import type { JobApplication } from '@shared/types';

interface ApplicationCardProps {
  application: JobApplication;
  userType: 'freelancer' | 'recruiter';
  currentUserId: number;
}

export function ApplicationCard({ application, userType, currentUserId }: ApplicationCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [showHireConfirm, setShowHireConfirm] = useState(false);
  const [rejectionMessage, setRejectionMessage] = useState('');

  const rejectMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/applications/${application.id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: rejectionMessage }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recruiter', currentUserId, 'applications'] });
      setShowRejectionDialog(false);
      setRejectionMessage('');
      toast({
        title: 'Application rejected',
        description: 'The applicant has been notified with your message.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to reject application.',
        variant: 'destructive',
      });
    },
  });

  const hireMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/applications/${application.id}/accept`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recruiter', currentUserId, 'applications'] });
      setShowHireConfirm(false);
      toast({
        title: 'Applicant hired!',
        description: 'The applicant has been notified of their successful application.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to hire applicant.',
        variant: 'destructive',
      });
    },
  });

  const handleRejectClick = () => {
    setRejectionMessage('');
    setShowRejectionDialog(true);
  };

  const handleConfirmReject = () => {
    rejectMutation.mutate();
  };

  const handleConfirmHire = () => {
    hireMutation.mutate();
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'hired': return 'default';
      case 'reviewed': return 'secondary';
      case 'rejected': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'hired': return <CheckCircle className="w-4 h-4" />;
      case 'rejected': return <X className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-medium">
                {userType === 'recruiter' ? (
                  application.freelancer_profile ? 
                    `${application.freelancer_profile.first_name} ${application.freelancer_profile.last_name}` : 
                    'Freelancer'
                ) : (
                  application.job_title || 'Job Application'
                )}
              </h4>
              <Badge variant={getStatusBadgeVariant(application.status)} className="flex items-center gap-1">
                {getStatusIcon(application.status)}
                {application.status}
              </Badge>
            </div>
            
            {userType === 'recruiter' ? (
              <p className="text-sm text-muted-foreground mb-2">Applied for: {application.job_title}</p>
            ) : (
              <p className="text-sm text-muted-foreground mb-2">Company: {application.job_company}</p>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
              {userType === 'recruiter' && application.freelancer_profile && (
                <>
                  <div>Rate: {application.freelancer_profile.hourly_rate ? `£${application.freelancer_profile.hourly_rate}/${application.freelancer_profile.rate_type}` : 'Not specified'}</div>
                  <div>Experience: {application.freelancer_profile.experience_years ? `${application.freelancer_profile.experience_years} years` : 'Not specified'}</div>
                </>
              )}
              <div>Applied: {new Date(application.applied_at).toLocaleDateString()}</div>
            </div>
            
            {application.cover_letter && (
              <div className="mt-3">
                <p className="text-sm font-medium mb-1">Cover Letter:</p>
                <p className="text-sm text-muted-foreground line-clamp-2">{application.cover_letter}</p>
              </div>
            )}

            {application.rejection_message && application.status === 'rejected' && (
              <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">Rejection Reason:</p>
                <p className="text-sm text-red-700 dark:text-red-300">{application.rejection_message}</p>
                <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
                  <DialogTrigger asChild>
                    <Button variant="link" size="sm" className="text-red-600 hover:text-red-700 p-0 h-auto">
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
                        <p className="text-sm text-muted-foreground">Company: {application.job_company}</p>
                      </div>
                      <div>
                        <p className="font-medium mb-2">Rejection Message:</p>
                        <p className="text-sm text-muted-foreground bg-muted p-3 rounded">{application.rejection_message}</p>
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
          
          <div className="flex gap-2 ml-4">
            {userType === 'recruiter' && application.freelancer_profile && (
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.open(`/profile/${application.freelancer_profile?.user_id}`, '_blank')}
                  data-testid={`button-view-profile-${application.freelancer_profile.user_id}`}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Profile
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  data-testid={`button-message-${application.freelancer_profile.user_id}`}
                >
                  <MessageCircle className="w-4 h-4 mr-1" />
                  Message
                </Button>
                
                {(application.status === 'applied' || application.status === 'reviewed') && (
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
                            Are you sure you want to accept this application from{' '}
                            <strong>
                              {application.freelancer_profile ? 
                                `${application.freelancer_profile.first_name} ${application.freelancer_profile.last_name}` : 
                                'this freelancer'
                              }
                            </strong> for the position <strong>"{application.job_title}"</strong>?
                            
                            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                              <p className="text-sm text-green-700 dark:text-green-300">
                                The applicant will be notified immediately and can start coordination with you.
                              </p>
                            </div>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={hireMutation.isPending}>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={handleConfirmHire}
                            disabled={hireMutation.isPending}
                            className="bg-green-600 hover:bg-green-700 text-white"
                            data-testid={`button-confirm-hire-${application.id}`}
                          >
                            {hireMutation.isPending ? 'Accepting...' : 'Yes, Accept Application'}
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
                              You are about to reject the application from{' '}
                              <strong>
                                {application.freelancer_profile ? 
                                  `${application.freelancer_profile.first_name} ${application.freelancer_profile.last_name}` : 
                                  'this freelancer'
                                }
                              </strong> for <strong>"{application.job_title}"</strong>.
                            </p>
                          </div>
                          <div>
                            <Label htmlFor="rejection-message">
                              Rejection message <span className="text-muted-foreground">(optional but recommended)</span>
                            </Label>
                            <Textarea
                              id="rejection-message"
                              placeholder="Provide constructive feedback to help the applicant improve future applications..."
                              value={rejectionMessage}
                              onChange={(e) => setRejectionMessage(e.target.value)}
                              className="mt-2 min-h-[100px]"
                              data-testid={`textarea-rejection-message-${application.id}`}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              This message will be sent to the applicant along with the rejection notification.
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
                            {rejectMutation.isPending ? 'Rejecting...' : 'Reject Application'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}