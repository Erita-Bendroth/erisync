import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Calendar, User } from 'lucide-react';
import { format } from 'date-fns';
import { formatUserName } from '@/lib/utils';

interface MobileScheduleCardProps {
  entry: {
    id: string;
    user_id: string;
    date: string;
    shift_type: string;
    activity_type: string;
    availability_status: string;
    notes?: string;
    profiles: {
      first_name: string;
      last_name: string;
      initials?: string;
    };
    teams: {
      name: string;
    };
  };
  onEdit?: () => void;
  canEdit?: boolean;
}

export const MobileScheduleCard: React.FC<MobileScheduleCardProps> = ({
  entry,
  onEdit,
  canEdit = false,
}) => {
  const getShiftBadgeVariant = (shiftType: string) => {
    switch (shiftType) {
      case 'early':
        return 'default';
      case 'late':
        return 'secondary';
      case 'weekend':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getActivityBadgeVariant = (activityType: string) => {
    switch (activityType) {
      case 'vacation':
        return 'default';
      case 'sick':
        return 'destructive';
      case 'out_of_office':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getAvailabilityColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'text-green-600 dark:text-green-400';
      case 'unavailable':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <p className="font-medium text-sm truncate">
                {formatUserName(
                  entry.profiles.first_name,
                  entry.profiles.last_name,
                  entry.profiles.initials
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                {format(new Date(entry.date), 'EEE, MMM d, yyyy')}
              </p>
            </div>
          </div>
          {canEdit && onEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              className="h-8 w-8 p-0 flex-shrink-0"
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant={getShiftBadgeVariant(entry.shift_type)}>
            {entry.shift_type || 'normal'}
          </Badge>
          <Badge variant={getActivityBadgeVariant(entry.activity_type)}>
            {entry.activity_type}
          </Badge>
          <Badge
            variant="outline"
            className={getAvailabilityColor(entry.availability_status)}
          >
            {entry.availability_status}
          </Badge>
        </div>

        {/* Team */}
        <p className="text-xs text-muted-foreground">
          Team: <span className="font-medium">{entry.teams.name}</span>
        </p>

        {/* Notes */}
        {entry.notes && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground line-clamp-2">
              {entry.notes}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
