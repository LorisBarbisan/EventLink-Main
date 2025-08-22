import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { Notification } from '@shared/schema';

interface UseNotificationsProps {
  userId?: number;
}

export function useNotifications({ userId }: UseNotificationsProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Function to create a new notification
  const createNotification = useCallback(async (notification: {
    user_id: number;
    type: 'application_update' | 'new_message' | 'job_update' | 'profile_view' | 'system';
    title: string;
    message: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    related_entity_type?: 'job' | 'application' | 'message' | 'profile' | null;
    related_entity_id?: number;
    action_url?: string;
    metadata?: string;
    expires_at?: Date;
  }) => {
    try {
      const result = await apiRequest('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notification),
      });

      // Invalidate notification queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });

      return result;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }, [queryClient]);

  // Function to create application update notifications
  const notifyApplicationUpdate = useCallback(async (
    freelancerId: number,
    jobTitle: string,
    status: 'reviewed' | 'shortlisted' | 'rejected' | 'hired',
    jobId: number,
    rejectionMessage?: string
  ) => {
    const statusMessages = {
      reviewed: `Your application for "${jobTitle}" has been reviewed`,
      shortlisted: `Great news! You've been shortlisted for "${jobTitle}"`,
      rejected: `Unfortunately, your application for "${jobTitle}" was not successful`,
      hired: `Congratulations! You've been hired for "${jobTitle}"`
    };

    const priorities = {
      reviewed: 'normal' as const,
      shortlisted: 'high' as const,
      rejected: 'normal' as const,
      hired: 'urgent' as const
    };

    await createNotification({
      user_id: freelancerId,
      type: 'application_update',
      title: 'Application Status Update',
      message: rejectionMessage || statusMessages[status],
      priority: priorities[status],
      related_entity_type: 'application',
      related_entity_id: jobId,
      action_url: '/dashboard?tab=applications',
    });
  }, [createNotification]);

  // Function to create new message notifications
  const notifyNewMessage = useCallback(async (
    recipientId: number,
    senderName: string,
    conversationId: number
  ) => {
    await createNotification({
      user_id: recipientId,
      type: 'new_message',
      title: 'New Message',
      message: `You have a new message from ${senderName}`,
      priority: 'high',
      related_entity_type: 'message',
      related_entity_id: conversationId,
      action_url: '/messages',
    });
  }, [createNotification]);

  // Function to create job update notifications
  const notifyJobUpdate = useCallback(async (
    freelancerIds: number[],
    jobTitle: string,
    updateType: 'new_job' | 'job_closed' | 'job_updated',
    jobId: number
  ) => {
    const messages = {
      new_job: `New job opportunity: "${jobTitle}" matches your skills`,
      job_closed: `Job "${jobTitle}" has been closed`,
      job_updated: `Job "${jobTitle}" has been updated`
    };

    const promises = freelancerIds.map(freelancerId =>
      createNotification({
        user_id: freelancerId,
        type: 'job_update',
        title: 'Job Update',
        message: messages[updateType],
        priority: updateType === 'new_job' ? 'high' : 'normal',
        related_entity_type: 'job',
        related_entity_id: jobId,
        action_url: `/jobs/${jobId}`,
      })
    );

    await Promise.all(promises);
  }, [createNotification]);

  // Function to create profile view notifications
  const notifyProfileView = useCallback(async (
    profileOwnerId: number,
    viewerName: string,
    viewerRole: 'freelancer' | 'recruiter'
  ) => {
    await createNotification({
      user_id: profileOwnerId,
      type: 'profile_view',
      title: 'Profile Viewed',
      message: `A ${viewerRole} (${viewerName}) viewed your profile`,
      priority: 'low',
      related_entity_type: 'profile',
      related_entity_id: profileOwnerId,
      action_url: '/profile',
    });
  }, [createNotification]);

  // Function to create system notifications
  const notifySystem = useCallback(async (
    userIds: number[],
    title: string,
    message: string,
    priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal',
    actionUrl?: string,
    expiresAt?: Date
  ) => {
    const promises = userIds.map(userId =>
      createNotification({
        user_id: userId,
        type: 'system',
        title,
        message,
        priority,
        action_url: actionUrl,
        expires_at: expiresAt,
      })
    );

    await Promise.all(promises);
  }, [createNotification]);

  // WebSocket integration for real-time notifications
  useEffect(() => {
    if (!userId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      // Send user ID to identify this connection
      ws.send(JSON.stringify({ type: 'identify', userId }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'new_notification') {
          // Invalidate notification queries to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
          queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
          
          // Show toast notification
          if (data.notification) {
            const notification = data.notification as Notification;
            toast({
              title: notification.title,
              description: notification.message,
              duration: 5000,
            });
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      ws.close();
    };
  }, [userId, queryClient, toast]);

  return {
    createNotification,
    notifyApplicationUpdate,
    notifyNewMessage,
    notifyJobUpdate,
    notifyProfileView,
    notifySystem,
  };
}