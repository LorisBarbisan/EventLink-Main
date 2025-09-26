import { useEffect, useRef } from 'react';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { MessageCircle, Briefcase, User, AlertCircle, Star } from 'lucide-react';

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
      description: message.content.length > 60 
        ? `${message.content.substring(0, 60)}...` 
        : message.content,
      duration: 6000,
      action: {
        altText: "View message",
        onClick: () => {
          setLocation('/dashboard?tab=messages');
        },
      },
    });
  };

  const showApplicationUpdatePopup = (application: any, status: string) => {
    const statusMessages = {
      reviewed: '👀 Your application has been reviewed',
      shortlisted: '🎉 You\'ve been shortlisted!',
      rejected: '❌ Application not successful',
      hired: '🎊 Congratulations! You\'re hired!'
    };

    const statusColors = {
      reviewed: 'bg-blue-50',
      shortlisted: 'bg-green-50', 
      rejected: 'bg-red-50',
      hired: 'bg-green-100'
    };

    toast({
      title: statusMessages[status as keyof typeof statusMessages] || 'Application Update',
      description: `Job: ${application.job_title || 'Position'}`,
      duration: status === 'hired' ? 10000 : 6000, // Show longer for good news
      action: {
        altText: "View application",
        onClick: () => {
          setLocation('/dashboard?tab=jobs');
        },
      },
    });
  };

  const showJobUpdatePopup = (job: any) => {
    toast({
      title: '📋 Job Update',
      description: `New job posted: ${job.title}`,
      duration: 6000,
      action: {
        altText: "View job",
        onClick: () => {
          setLocation('/jobs');
        },
      },
    });
  };

  const showRatingRequestPopup = (request: any) => {
    toast({
      title: '⭐ Rating Request',
      description: 'A recruiter would like you to rate your experience',
      duration: 6000,
      action: {
        altText: "View ratings",
        onClick: () => {
          setLocation('/ratings');
        },
      },
    });
  };

  const showRatingReceivedPopup = (rating: any) => {
    const stars = '⭐'.repeat(rating.rating);
    
    toast({
      title: `🌟 New ${rating.rating}-star rating!`,
      description: `${stars} ${rating.comment ? rating.comment.substring(0, 50) + '...' : ''}`,
      duration: 8000, // Show longer for positive feedback
      action: {
        altText: "View rating",
        onClick: () => {
          setLocation('/ratings');
        },
      },
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
      action: notification.action_url ? {
        altText: "View",
        onClick: () => {
          if (notification.action_url.startsWith('/')) {
            setLocation(notification.action_url);
          } else {
            window.open(notification.action_url, '_blank');
          }
        },
      } : undefined,
    });
  };

  // This component doesn't render anything - it just manages popup notifications
  return null;
}