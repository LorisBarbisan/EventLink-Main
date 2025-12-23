// components/notifications/NotificationItem.tsx
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notification } from "@shared/schema";
import {
    AlertCircle,
    Bell,
    Briefcase,
    Check,
    Clock,
    Mail,
    MessageCircle,
    MessageSquare,
    User,
    X,
} from "lucide-react";
import { memo } from "react";

interface Props {
  notification: Notification;
  onClick: () => void;
  onMarkRead: () => void;
  onDelete: () => void;
  isMarkAsReadDisabled: boolean;
  isDeleteDisabled: boolean;
}

const getNotificationIcon = (type: string, priority: string) => {
  if (priority === "urgent") {
    return <AlertCircle className="w-4 h-4 text-red-500" />;
  }

  switch (type) {
    case "new_message":
      return <MessageCircle className="w-4 h-4 text-blue-500" />;
    case "application_update":
      return <Briefcase className="w-4 h-4 text-green-500" />;
    case "job_update":
      return <Briefcase className="w-4 h-4 text-purple-500" />;
    case "profile_view":
      return <User className="w-4 h-4 text-orange-500" />;
    case "feedback":
      return <MessageSquare className="w-4 h-4 text-blue-500" />;
    case "contact_message":
      return <Mail className="w-4 h-4 text-purple-500" />;
    case "system":
      return <Bell className="w-4 h-4 text-gray-500" />;
    default:
      return <Bell className="w-4 h-4 text-gray-500" />;
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "urgent":
      return "bg-red-50 border-red-200";
    case "high":
      return "bg-orange-50 border-orange-200";
    case "normal":
      return "bg-blue-50 border-blue-200";
    case "low":
      return "bg-gray-50 border-gray-200";
    default:
      return "bg-gray-50 border-gray-200";
  }
};

const formatRelativeTime = (date: Date) => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};

const NotificationItem = memo(
  ({
    notification,
    onClick,
    onMarkRead,
    onDelete,
    isMarkAsReadDisabled,
    isDeleteDisabled,
  }: Props) => {
    return (
      <div
        className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
          !notification.is_read ? getPriorityColor(notification.priority || "normal") : ""
        }`}
        onClick={onClick}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            {getNotificationIcon(notification.type, notification.priority || "normal")}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium truncate ${
                    !notification.is_read ? "text-gray-900" : "text-gray-600"
                  }`}
                >
                  {notification.title}
                </p>

                <p
                  className={`text-sm mt-1 ${
                    !notification.is_read ? "text-gray-700" : "text-gray-500"
                  }`}
                >
                  {notification.message}
                </p>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {!notification.is_read && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isMarkAsReadDisabled}
                    onClick={e => {
                      e.stopPropagation();
                      onMarkRead();
                    }}
                  >
                    <Check className="w-3 h-3" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isDeleteDisabled}
                  onClick={e => {
                    e.stopPropagation();
                    onDelete();
                  }}
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

              {notification.priority !== "normal" && (
                <Badge
                  variant={notification.priority === "urgent" ? "destructive" : "secondary"}
                  className="text-xs px-1 py-0"
                >
                  {notification.priority}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

NotificationItem.displayName = "NotificationItem";

export default NotificationItem;
