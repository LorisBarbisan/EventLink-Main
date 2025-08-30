import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Eye, MessageCircle, CheckCircle, X, AlertCircle } from 'lucide-react';
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

  const rejectMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/applications/${application.id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recruiter', currentUserId, 'applications'] });
      setShowRejectionDialog(false);
      toast({
        title: 'Application rejected',
        description: 'The applicant has been notified.',
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
      return await apiRequest(`/api/applications/${application.id}/hire`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recruiter', currentUserId, 'applications'] });
      toast({
        title: 'Applicant hired',
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
                
                {application.status === 'pending' && (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => hireMutation.mutate()}
                      disabled={hireMutation.isPending}
                      data-testid={`button-hire-${application.id}`}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      {hireMutation.isPending ? 'Hiring...' : 'Hire'}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => rejectMutation.mutate()}
                      disabled={rejectMutation.isPending}
                      data-testid={`button-reject-${application.id}`}
                    >
                      <X className="w-4 h-4 mr-1" />
                      {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
                    </Button>
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