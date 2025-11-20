import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Calendar, User } from 'lucide-react';
import { format } from 'date-fns';
import { formatUserName, cn } from '@/lib/utils';

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
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPast = new Date(entry.date) < today;
  
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

  const parseTimeBlocks = (notes: string | undefined) => {
    if (!notes) return null;
    
    const trimmed = notes.trim();
    
    // Try direct JSON array format: [{"activity_type":"work",...}]
    if (trimmed.startsWith('[{')) {
      try {
        const blocks = JSON.parse(trimmed);
        if (Array.isArray(blocks) && blocks.length > 0 && blocks[0].start_time) {
          return blocks;
        }
      } catch (e) {
        console.error('Failed to parse time blocks:', e);
      }
    }
    
    // Try "Times: [{...}]" format
    const timesMatch = trimmed.match(/Times:\s*(\[.+\])/);
    if (timesMatch) {
      try {
        const blocks = JSON.parse(timesMatch[1]);
        if (Array.isArray(blocks) && blocks.length > 0) {
          return blocks;
        }
      } catch (e) {
        console.error('Failed to parse Times format:', e);
      }
    }
    
    return null;
  };

  const isUnscheduled = () => {
    // Check if entry is just "available" with no actual work scheduled
    const hasTimeBlocks = entry.notes && parseTimeBlocks(entry.notes);
    const isJustAvailable = entry.activity_type === 'work' && 
                            entry.availability_status === 'available';
    const noSpecificShift = !entry.shift_type || entry.shift_type === 'normal';
    
    return isJustAvailable && noSpecificShift && !hasTimeBlocks;
  };

  const formatTimeBlocks = (blocks: any[]) => {
    return blocks.map((block) => {
      const activity = block.activity_type || 'work';
      const start = block.start_time || '';
      const end = block.end_time || '';
      
      // Capitalize activity and format nicely
      const formattedActivity = activity.charAt(0).toUpperCase() + activity.slice(1);
      return `${formattedActivity}: ${start} - ${end}`;
    }).join(' • ');
  };

  return (
    <Card className={cn("relative overflow-hidden", isPast && "opacity-60")}>
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
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <p className={cn("text-xs", isPast ? "text-muted-foreground" : "text-muted-foreground")}>
                  {format(new Date(entry.date), 'EEE, MMM d, yyyy')}
                </p>
              </div>
              {isPast && (
                <Badge variant="outline" className="text-xs">
                  Past
                </Badge>
              )}
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
          {isUnscheduled() ? (
            <Badge variant="outline" className="text-muted-foreground">
              Unscheduled
            </Badge>
          ) : (
            <>
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
            </>
          )}
        </div>

        {/* Team */}
        <p className="text-xs text-muted-foreground">
          Team: <span className="font-medium">{entry.teams.name}</span>
        </p>

        {/* Time Blocks or Notes */}
        {entry.notes && !isUnscheduled() && (() => {
          const timeBlocks = parseTimeBlocks(entry.notes);
          
          if (timeBlocks && timeBlocks.length > 0) {
            return (
              <div className="pt-2 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-1">Schedule:</p>
                <p className="text-xs text-foreground">
                  {formatTimeBlocks(timeBlocks)}
                </p>
              </div>
            );
          } else if (!entry.notes.trim().startsWith('[{')) {
            // Only show plain text notes if they're not JSON
            return (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {entry.notes}
                </p>
              </div>
            );
          }
          return null;
        })()}
      </CardContent>
    </Card>
  );
};
