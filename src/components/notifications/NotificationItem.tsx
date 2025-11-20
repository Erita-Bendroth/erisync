import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  UserCheck, 
  AlertCircle, 
  CheckCircle2, 
  XCircle,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useNotifications, type Notification } from '@/hooks/useNotifications';

interface NotificationItemProps {
  notification: Notification;
  onClose?: () => void;
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'vacation_request':
      return Calendar;
    case 'swap_request':
      return RefreshCw;
    case 'schedule_change':
      return Calendar;
    case 'approval':
      return CheckCircle2;
    case 'rejection':
      return XCircle;
    case 'system':
      return AlertCircle;
    default:
      return AlertCircle;
  }
};

const getNotificationColor = (type: string) => {
  switch (type) {
    case 'approval':
      return 'text-green-600 dark:text-green-400';
    case 'rejection':
      return 'text-destructive';
    case 'vacation_request':
    case 'swap_request':
      return 'text-blue-600 dark:text-blue-400';
    case 'system':
      return 'text-yellow-600 dark:text-yellow-400';
    default:
      return 'text-muted-foreground';
  }
};

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onClose,
}) => {
  const navigate = useNavigate();
  const { markAsRead, deleteNotification } = useNotifications();
  const Icon = getNotificationIcon(notification.type);
  const colorClass = getNotificationColor(notification.type);

  const handleClick = () => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
      onClose?.();
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteNotification(notification.id);
  };

  return (
    <div
      className={cn(
        "p-4 hover:bg-accent/50 transition-colors cursor-pointer relative group",
        !notification.read && "bg-accent/30"
      )}
      onClick={handleClick}
    >
      {/* Unread indicator */}
      {!notification.read && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary" />
      )}

      <div className={cn("flex gap-3", !notification.read && "pl-3")}>
        {/* Icon */}
        <div className={cn("flex-shrink-0 mt-0.5", colorClass)}>
          <Icon className="h-5 w-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-sm font-medium line-clamp-1",
                !notification.read && "font-semibold"
              )}>
                {notification.title}
              </p>
              <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                {notification.message}
              </p>
            </div>

            {/* Delete button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              onClick={handleDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Time */}
          <p className="text-xs text-muted-foreground mt-1">
            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>
    </div>
  );
};
