import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Bell, Check, CheckCheck, X, Clock, AlertCircle, MessageCircle, Briefcase, User } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import type { Notification } from '@shared/schema';

interface NotificationSystemProps {
  userId: number;
}

const getNotificationIcon = (type: string, priority: string) => {
  if (priority === 'urgent') {
    return <AlertCircle className="w-4 h-4 text-red-500" />;
  }

  switch (type) {
    case 'new_message':
      return <MessageCircle className="w-4 h-4 text-blue-500" />;
    case 'application_update':
      return <Briefcase className="w-4 h-4 text-green-500" />;
    case 'job_update':
      return <Briefcase className="w-4 h-4 text-purple-500" />;
    case 'profile_view':
      return <User className="w-4 h-4 text-orange-500" />;
    case 'system':
      return <Bell className="w-4 h-4 text-gray-500" />;
    default:
      return <Bell className="w-4 h-4 text-gray-500" />;
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return 'bg-red-50 border-red-200';
    case 'high':
      return 'bg-orange-50 border-orange-200';
    case 'normal':
      return 'bg-blue-50 border-blue-200';
    case 'low':
      return 'bg-gray-50 border-gray-200';
    default:
      return 'bg-gray-50 border-gray-200';
  }
};

const formatRelativeTime = (date: Date) => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

export function NotificationSystem({ userId }: NotificationSystemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notifications - only when dropdown is open
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['/api/notifications', userId],
    queryFn: () => apiRequest('/api/notifications') as Promise<Notification[]>,
    refetchInterval: isOpen ? 10000 : false, // Only poll when dropdown is open
    enabled: isOpen, // Only fetch when user opens dropdown
  });

  // Fetch unread count with smart polling
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['/api/notifications/unread-count', userId],
    queryFn: async () => {
      const data = await apiRequest('/api/notifications/unread-count');
      return data.count;
    },
    refetchInterval: 20000, // Reduced from 10s to 20s
    refetchIntervalInBackground: false, // Stop when tab is inactive
  });

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      return apiRequest(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications', userId] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count', userId] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to mark notification as read',
        variant: 'destructive',
      });
    },
  });

  // Mark all notifications as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/notifications/mark-all-read', {
        method: 'PATCH',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications', userId] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count', userId] });
      toast({
        title: 'Success',
        description: 'All notifications marked as read',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to mark all notifications as read',
        variant: 'destructive',
      });
    },
  });

  // Delete notification
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      return apiRequest(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications', userId] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count', userId] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete notification',
        variant: 'destructive',
      });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read if unread
    if (!notification.is_read) {
      markAsReadMutation.mutate(notification.id);
    }

    // Navigate to action URL if provided
    if (notification.action_url) {
      window.open(notification.action_url, '_blank');
    }
  };

  const unreadNotifications = notifications.filter(n => !n.is_read);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
        data-testid="button-notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 text-xs p-0 flex items-center justify-center"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <div 
          ref={dropdownRef}
          className="absolute right-0 top-full mt-2 w-96 bg-white border rounded-lg shadow-lg z-50"
        >
          <Card className="border-0 shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">Notifications</CardTitle>
                <div className="flex items-center gap-2">
                  {unreadNotifications.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAllAsReadMutation.mutate()}
                      disabled={markAllAsReadMutation.isPending}
                      data-testid="button-mark-all-read"
                    >
                      <CheckCheck className="w-4 h-4 mr-1" />
                      Mark all read
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              {unreadCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  You have {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                </p>
              )}
            </CardHeader>

            <Separator />

            <CardContent className="p-0">
              <ScrollArea className="h-96">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-sm text-muted-foreground">Loading notifications...</div>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No notifications yet</p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                          !notification.is_read ? getPriorityColor(notification.priority || 'normal') : ''
                        }`}
                        onClick={() => handleNotificationClick(notification)}
                        data-testid={`notification-${notification.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-1">
                            {getNotificationIcon(notification.type, notification.priority || 'normal')}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium truncate ${
                                  !notification.is_read ? 'text-gray-900' : 'text-gray-600'
                                }`}>
                                  {notification.title}
                                </p>
                                <p className={`text-sm mt-1 ${
                                  !notification.is_read ? 'text-gray-700' : 'text-gray-500'
                                }`}>
                                  {notification.message}
                                </p>
                              </div>
                              
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {!notification.is_read && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      markAsReadMutation.mutate(notification.id);
                                    }}
                                    disabled={markAsReadMutation.isPending}
                                    data-testid={`button-mark-read-${notification.id}`}
                                  >
                                    <Check className="w-3 h-3" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteNotificationMutation.mutate(notification.id);
                                  }}
                                  disabled={deleteNotificationMutation.isPending}
                                  data-testid={`button-delete-${notification.id}`}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 mt-2">
                              <Clock className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {formatRelativeTime(new Date(notification.created_at))}
                              </span>
                              {notification.priority !== 'normal' && (
                                <Badge 
                                  variant={notification.priority === 'urgent' ? 'destructive' : 'secondary'}
                                  className="text-xs px-1 py-0"
                                >
                                  {notification.priority}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}