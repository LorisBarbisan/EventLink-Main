// components/notifications/NotificationHeader.tsx
import { Button } from "@/components/ui/button";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCheck, X } from "lucide-react";

interface Props {
  unreadCount: number;
  onMarkAllRead: () => void;
  onClose: () => void;
  isMarkingAll: boolean;
}

export default function NotificationHeader({
  unreadCount,
  onMarkAllRead,
  onClose,
  isMarkingAll,
}: Props) {
  return (
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <CardTitle className="text-lg font-semibold">Notifications</CardTitle>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMarkAllRead}
              disabled={isMarkingAll}
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="w-4 h-4 mr-1" />
              Mark all read
            </Button>
          )}

          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {unreadCount > 0 && (
        <p className="text-sm text-muted-foreground">
          You have {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
        </p>
      )}
    </CardHeader>
  );
}
