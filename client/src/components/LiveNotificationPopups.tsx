import { useEffect, useRef } from 'react';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { MessageCircle, Briefcase, User, AlertCircle, Star } from 'lucide-react';
import { ToastAction } from '@/components/ui/toast';

interface LiveNotificationPopupsProps {
  enabled?: boolean;
}

export function LiveNotificationPopups({ enabled = true }: LiveNotificationPopupsProps) {
  const { user } = useOptimizedAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!user?.id || !enabled) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Live notifications WebSocket connected');
        ws.send(JSON.stringify({ type: 'authenticate', userId: user.id }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle different types of real-time events
          switch (data.type) {
            case 'new_message':
              showMessagePopup(data.message, data.sender);
              break;
            case 'application_update':
              showApplicationUpdatePopup(data.application, data.status);
              break;
            case 'job_update':
              showJobUpdatePopup(data.job);
              break;
            case 'rating_request':
              showRatingRequestPopup(data.request);
              break;
            case 'rating_received':
              showRatingReceivedPopup(data.rating);
              break;
            case 'new_notification':
              // Generic notification handler
              showGenericNotificationPopup(data.notification);
              break;
            default:
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('Live notifications WebSocket disconnected');
      };

      ws.onerror = (error) => {
        console.error('Live notifications WebSocket error:', error);
      };

      return () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
        wsRef.current = null;
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
    }
  }, [user?.id, enabled]);

  const showMessagePopup = (message: any, sender?: any) => {
    const senderName = sender?.first_name && sender?.last_name 
      ? `${sender.first_name} ${sender.last_name}`
      : sender?.company_name || 'Someone';

    toast({
      title: `💬 New message from ${senderName}`,
      description: message.content.length > 80 
        ? `${message.content.substring(0, 80)}...` 
        : message.content,
      duration: 8000, // Longer duration for better visibility
      className: "w-96 p-6", // Bigger notification
      action: (
        <ToastAction 
          altText="View message"
          onClick={() => setLocation('/dashboard?tab=messages')}
        >
          View Message
        </ToastAction>
      ),
    });
  };

  const showApplicationUpdatePopup = (application: any, status: string) => {
    const statusMessages = {
      reviewed: '👀 Your application has been reviewed',
      shortlisted: '🎉 You\'ve been shortlisted!',
      rejected: '❌ Application not successful',
      hired: '🎊 Congratulations! You\'re hired!'
    };

    const descriptions = {
      reviewed: `Your application for "${application.job_title || 'Position'}" has been reviewed by the employer. Check your dashboard for more details.`,
      shortlisted: `Great news! You've made it to the shortlist for "${application.job_title || 'Position'}". The employer will contact you soon.`,
      rejected: `Unfortunately, your application for "${application.job_title || 'Position'}" was not successful this time. Don't give up - keep applying!`,
      hired: `Congratulations! You've been hired for "${application.job_title || 'Position'}". The employer will contact you with next steps.`
    };

    toast({
      title: statusMessages[status as keyof typeof statusMessages] || 'Application Update',
      description: descriptions[status as keyof typeof descriptions] || `Job: ${application.job_title || 'Position'}`,
      duration: status === 'hired' ? 12000 : 8000, // Show longer for good news
      className: "w-96 p-6", // Bigger notification
      action: (
        <ToastAction 
          altText="View application"
          onClick={() => setLocation('/dashboard?tab=jobs')}
        >
          View Application
        </ToastAction>
      ),
    });
  };

  const showJobUpdatePopup = (job: any) => {
    toast({
      title: '📋 New Job Opportunity',
      description: `A new job "${job.title}" has been posted that matches your profile. Location: ${job.location || 'Not specified'}. Apply now to secure your spot!`,
      duration: 8000,
      className: "w-96 p-6", // Bigger notification
      action: (
        <ToastAction 
          altText="View job"
          onClick={() => setLocation('/jobs')}
        >
          View Job
        </ToastAction>
      ),
    });
  };

  const showRatingRequestPopup = (request: any) => {
    toast({
      title: '⭐ Rating Request',
      description: `A recruiter would like you to rate your experience working on "${request.job_title || 'a recent job'}". Your feedback helps build trust in the EventLink community.`,
      duration: 8000,
      className: "w-96 p-6", // Bigger notification
      action: (
        <ToastAction 
          altText="Rate experience"
          onClick={() => setLocation('/ratings')}
        >
          Rate Experience
        </ToastAction>
      ),
    });
  };

  const showRatingReceivedPopup = (rating: any) => {
    const stars = '⭐'.repeat(rating.rating);
    
    toast({
      title: `🌟 New ${rating.rating}-star rating received!`,
      description: `${stars} You received a ${rating.rating}/5 star rating! ${rating.comment ? `"${rating.comment.substring(0, 80)}${rating.comment.length > 80 ? '...' : ''}"` : 'Great work keeps building your reputation!'}`,
      duration: 10000, // Show longer for positive feedback
      className: "w-96 p-6", // Bigger notification
      action: (
        <ToastAction 
          altText="View rating"
          onClick={() => setLocation('/ratings')}
        >
          View Rating
        </ToastAction>
      ),
    });
  };

  const showGenericNotificationPopup = (notification: any) => {
    const getIcon = (type: string) => {
      switch (type) {
        case 'new_message':
          return '💬';
        case 'application_update':
          return '📋';
        case 'job_update':
          return '💼';
        case 'rating_received':
        case 'rating_request':
          return '⭐';
        case 'profile_view':
          return '👀';
        default:
          return '🔔';
      }
    };

    toast({
      title: `${getIcon(notification.type)} ${notification.title}`,
      description: notification.message,
      duration: 6000,
      className: "w-96 p-6", // Bigger notification
      action: notification.action_url ? (
        <ToastAction 
          altText="View"
          onClick={() => {
            if (notification.action_url.startsWith('/')) {
              setLocation(notification.action_url);
            } else {
              window.open(notification.action_url, '_blank');
            }
          }}
        >
          View
        </ToastAction>
      ) : undefined,
    });
  };

  // This component doesn't render anything - it just manages popup notifications
  return null;
}