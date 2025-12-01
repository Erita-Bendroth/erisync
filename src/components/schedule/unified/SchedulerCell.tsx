import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Database } from '@/integrations/supabase/types';
import type { OnlineUser } from '@/hooks/useSchedulerPresence';

type ShiftType = Database['public']['Enums']['shift_type'];
type AvailabilityStatus = Database['public']['Enums']['availability_status'];
type ActivityType = Database['public']['Enums']['activity_type'];

interface SchedulerCellProps {
  userId: string;
  date: string;
  shiftType: ShiftType | null;
  availabilityStatus: AvailabilityStatus;
  activityType?: ActivityType;
  isSelected: boolean;
  isHovered: boolean;
  isEditing: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onMouseDown: () => void;
  onMouseUp: () => void;
  editingBy?: OnlineUser[];
  enableQuickDialog?: boolean;
  canViewActivityDetails?: boolean;
  isPartnershipView?: boolean;
  hotlineAssignment?: {
    id: string;
    notes: string | null;
    responsibility_region: string | null;
  };
}

const SHIFT_TYPE_LABELS: Record<string, string> = {
  early: 'E',
  late: 'L',
  normal: 'N',
  weekend: 'W',
};

const SHIFT_TYPE_COLORS: Record<string, string> = {
  early: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  late: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  normal: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  weekend: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
};

export const SchedulerCell: React.FC<SchedulerCellProps> = ({
  userId,
  date,
  shiftType,
  availabilityStatus,
  activityType,
  isSelected,
  isHovered,
  isEditing,
  onClick,
  onDoubleClick,
  onMouseEnter,
  onMouseLeave,
  onMouseDown,
  onMouseUp,
  editingBy = [],
  enableQuickDialog = false,
  canViewActivityDetails = true,
  isPartnershipView = false,
  hotlineAssignment,
}) => {
  const cellId = `${userId}:${date}`;
  const isBeingEdited = editingBy.length > 0;
  
  // In partnership view for regular team members, hide activity details except shift type
  const shouldHideActivityDetails = isPartnershipView && !canViewActivityDetails && activityType !== 'work';
  
  return (
    <div
      className={cn(
        'relative h-12 border-r border-b border-border transition-colors',
        'flex items-center justify-center',
        enableQuickDialog ? 'cursor-pointer hover:ring-2 hover:ring-primary/50' : 'cursor-pointer',
        isSelected && 'bg-accent',
        isHovered && !isSelected && 'bg-muted',
        isEditing && 'ring-2 ring-ring',
        availabilityStatus === 'unavailable' && 'bg-destructive/10',
        isBeingEdited && 'ring-2 ring-offset-1'
      )}
      style={
        isBeingEdited
          ? {
              // @ts-ignore - Custom property for ring color
              '--tw-ring-color': editingBy[0].color,
            }
          : undefined
      }
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      data-cell-id={cellId}
      title={enableQuickDialog ? 'Click to schedule' : undefined}
    >
      {/* Dual block display when both shift and hotline exist */}
      {shiftType && availabilityStatus === 'available' && hotlineAssignment ? (
        <div className="flex flex-col gap-0.5 items-center">
          <Badge
            variant="secondary"
            className={cn(
              'text-[10px] font-semibold px-1.5 py-0',
              SHIFT_TYPE_COLORS[shiftType] || 'bg-muted'
            )}
          >
            {SHIFT_TYPE_LABELS[shiftType] || shiftType.charAt(0).toUpperCase()}
          </Badge>
          <Badge
            variant="secondary"
            className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-[10px] font-semibold px-1.5 py-0"
            title={`Hotline: ${hotlineAssignment.notes || 'No time info'}`}
          >
            📞H
          </Badge>
        </div>
      ) : shiftType && availabilityStatus === 'available' ? (
        <Badge
          variant="secondary"
          className={cn(
            'text-xs font-semibold',
            SHIFT_TYPE_COLORS[shiftType] || 'bg-muted'
          )}
        >
          {SHIFT_TYPE_LABELS[shiftType] || shiftType.charAt(0).toUpperCase()}
        </Badge>
      ) : hotlineAssignment ? (
        <Badge
          variant="secondary"
          className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-xs font-semibold"
          title={`Hotline: ${hotlineAssignment.notes || 'No time info'}`}
        >
          📞H
        </Badge>
      ) : null}
      {availabilityStatus === 'unavailable' && !shouldHideActivityDetails && !hotlineAssignment && (
        <div className="w-2 h-2 rounded-full bg-destructive" />
      )}
      {shouldHideActivityDetails && !hotlineAssignment && (
        <div className="w-2 h-2 rounded-full bg-muted-foreground" title="Unavailable" />
      )}
      
      {/* Collaboration avatars - show who's editing */}
      {isBeingEdited && (
        <div className="absolute -top-1 -right-1 flex -space-x-1">
          {editingBy.slice(0, 2).map((user) => (
            <div
              key={user.user_id}
              className="w-6 h-6 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
              style={{ backgroundColor: user.color }}
              title={`${user.first_name} ${user.last_name} is editing`}
            >
              {user.initials}
            </div>
          ))}
          {editingBy.length > 2 && (
            <div
              className="w-6 h-6 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
              style={{ backgroundColor: 'hsl(var(--muted-foreground))' }}
              title={`+${editingBy.length - 2} more`}
            >
              +{editingBy.length - 2}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
